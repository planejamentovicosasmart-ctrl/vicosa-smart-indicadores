import { prisma } from '../lib/prisma.js';
import { cleanUrl } from '../utils/indicator.js';
import { runGeminiGrounded } from './gemini.js';

const OFFICIAL_HINTS = [
  'gov.br','ibge.gov.br','sidra.ibge.gov.br','datasus.gov.br','inep.gov.br',
  'tesouro.gov.br','aneel.gov.br','anatel.gov.br','mg.gov.br','vicosa.mg.gov.br',
  'saaevicosa.mg.gov.br','ufv.br','sinisa.gov.br','snis.gov.br','dados.gov.br',
  'gasmig.com.br',
];

function isOfficialUrl(url=''){
  const low=String(url).toLowerCase();
  return OFFICIAL_HINTS.some(d=>low.includes(d));
}
function extractOpenAIText(json){
  if(typeof json?.output_text==='string') return json.output_text;
  const chunks=[];
  for(const item of json?.output||[]) for(const content of item?.content||[]){
    if(typeof content?.text==='string') chunks.push(content.text);
  }
  return chunks.join('\n');
}
function parseJsonLoose(text){
  if(!text) return null;
  const clean=String(text).replace(/^```(?:json)?/i,'').replace(/```$/i,'').trim();
  try{return JSON.parse(clean);}catch{}
  const indexes=['{','['].map(x=>clean.indexOf(x)).filter(i=>i>=0);
  if(!indexes.length) return null;
  const start=Math.min(...indexes);
  for(let end=clean.length;end>start;end--){
    try{return JSON.parse(clean.slice(start,end));}catch{}
  }
  return null;
}
function clampScore(n){
  const v=Number(n);
  return Number.isFinite(v)?Math.max(0,Math.min(100,Math.round(v))):0;
}
function confidence(score){
  return score>=80?'HIGH':score>=55?'MEDIUM':'LOW';
}
function normalizeVerdict(v){
  const value=String(v||'INCONCLUSIVE').toUpperCase();
  return ['ADEQUATE','PARTIAL','INADEQUATE','INCONCLUSIVE'].includes(value)?value:'INCONCLUSIVE';
}
function currentSource(value){
  return {
    origin:value?.origin||null,
    sourceLabel:value?.sourceLabel||null,
    final:{value:value?.finalRaw??value?.finalNumber??null,year:value?.finalYear||null,source:value?.finalSource||null,url:value?.finalSourceUrl||null},
    numerator:{value:value?.numeratorRaw??value?.numeratorNumber??null,year:value?.numeratorYear||null,source:value?.numeratorSource||null,url:value?.numeratorSourceUrl||null},
    denominator:{value:value?.denominatorRaw??value?.denominatorNumber??null,year:value?.denominatorYear||null,source:value?.denominatorSource||null,url:value?.denominatorSourceUrl||null},
  };
}

const auditSchema={
  type:'object',
  properties:{
    verdict:{type:'string',enum:['ADEQUATE','PARTIAL','INADEQUATE','INCONCLUSIVE']},
    score:{type:'number',minimum:0,maximum:100},
    summary:{type:'string'},
    sourceName:{type:['string','null']},
    sourceOrganization:{type:['string','null']},
    sourceUrl:{type:['string','null']},
    referenceYear:{type:['string','null']},
    evidenceExcerpt:{type:['string','null']},
    criteria:{
      type:'object',
      properties:{
        sourceOfficial:{type:['boolean','null']},
        sourcePrimary:{type:['boolean','null']},
        municipalityMatch:{type:['boolean','null']},
        yearMatch:{type:['boolean','null']},
        conceptMatch:{type:['boolean','null']},
        numeratorMatch:{type:['boolean','null']},
        denominatorMatch:{type:['boolean','null']},
        unitMatch:{type:['boolean','null']},
        calculationMatch:{type:['boolean','null']},
        traceableEvidence:{type:['boolean','null']},
      },
      required:['sourceOfficial','sourcePrimary','municipalityMatch','yearMatch','conceptMatch','numeratorMatch','denominatorMatch','unitMatch','calculationMatch','traceableEvidence'],
      additionalProperties:false,
    },
    issues:{type:'array',items:{type:'string'},maxItems:12},
    recommendation:{type:'string'},
    recalculatedValue:{type:['string','null']},
  },
  required:['verdict','score','summary','sourceName','sourceOrganization','sourceUrl','referenceYear','evidenceExcerpt','criteria','issues','recommendation','recalculatedValue'],
  additionalProperties:false,
};

function auditPrompt(indicator,value,hint){
  const existing=currentSource(value);
  return `Você é um auditor técnico de evidências para indicadores municipais das ABNT NBR ISO 37120, 37122 e 37123.
Você NÃO certifica conformidade ABNT e NÃO aprova dados automaticamente. Você deve verificar se uma fonte pública realmente sustenta o dado usado no indicador cadastrado.

Município: Viçosa/MG
Norma: ABNT NBR ISO ${indicator.standard.code}
Código: ${indicator.code}
Indicador: ${indicator.name}
Descrição cadastrada: ${indicator.description||'não informada'}
Numerador: ${indicator.numeratorDescription||'não informado'}
Denominador: ${indicator.denominatorDescription||'não informado'}
Unidade: ${indicator.unit||'não informada'}
Fórmula: ${indicator.formula||value.finalFormula||'não informada'}
Dado atual: ${JSON.stringify(existing)}
Observações: ${indicator.notes||'nenhuma'}
Pista adicional do usuário: ${hint||'nenhuma'}

Regras:
1. Use Google Search e priorize fonte oficial, institucional, primária e rastreável.
2. Não trate "Viçosa SMART" como fonte. Viçosa SMART é origem do levantamento, não evidência.
3. Verifique explicitamente se a fonte é de Viçosa/MG e do ano/período correto.
4. Compare o conceito da fonte com o indicador, numerador, denominador, unidade e fórmula cadastrados.
5. Tema parecido não basta: a evidência precisa sustentar exatamente o dado usado.
6. Se houver numerador e denominador, confira compatibilidade temporal e semântica; recalcule quando possível.
7. Se o dado for zero, exija evidência positiva de zero/ausência do fenômeno; ausência de registro não basta.
8. Se aparecer agregador ou planilha interna, procure a fonte primária.
9. Se não houver evidência suficiente, use INCONCLUSIVE.
10. evidenceExcerpt deve ser uma paráfrase curta do que a fonte comprova, não uma citação inventada.
11. Veredito: ADEQUATE, PARTIAL, INADEQUATE ou INCONCLUSIVE.

Avalie: fonte oficial, fonte primária, município, ano, conceito, numerador, denominador, unidade, cálculo e rastreabilidade.
Retorne somente a estrutura solicitada.`;
}

async function auditWithGemini(indicator,value,hint){
  if(!process.env.GEMINI_API_KEY) return null;
  return runGeminiGrounded({
    input:auditPrompt(indicator,value,hint),
    schema:auditSchema,
    tools:['google_search'],
  });
}

async function auditWithOpenAI(indicator,value,hint){
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) return null;
  const model=process.env.OPENAI_MODEL||'gpt-5.6-sol';
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      model,
      tools:[{type:'web_search'}],
      input:[{role:'user',content:[{type:'input_text',text:`${auditPrompt(indicator,value,hint)}\n\nRetorne SOMENTE JSON válido.`}]}],
    }),
  });
  const json=await response.json();
  if(!response.ok) throw new Error(`OpenAI: ${json?.error?.message||response.statusText}`);
  const data=parseJsonLoose(extractOpenAIText(json));
  if(!data) throw new Error('OpenAI não retornou uma auditoria estruturada.');
  return {data,citations:[],queries:[],model,interactionId:null};
}

function chooseGroundedSource(parsed,citations){
  const requested=cleanUrl(parsed?.sourceUrl)||null;
  const exact=requested?citations.find(c=>cleanUrl(c.url)===requested):null;
  const official=citations.find(c=>isOfficialUrl(c.url));
  const citation=exact||official||citations[0]||null;
  return {
    url:exact?.url || citation?.url || requested || null,
    title:parsed?.sourceName || citation?.title || parsed?.sourceOrganization || null,
    exactCitation:Boolean(exact),
    citation,
  };
}

export async function auditIndicatorSource(indicatorId,{hint=null}={}){
  const indicator=await prisma.indicator.findUnique({
    where:{id:indicatorId},
    include:{standard:true,values:{where:{isCurrent:true},take:1,orderBy:{createdAt:'desc'}}},
  });
  if(!indicator) throw new Error('Indicador não encontrado');
  const value=indicator.values?.[0]||null;
  if(!value) throw new Error('Este indicador ainda não possui dado/fonte para auditar');

  let provider='none';
  let result=await auditWithGemini(indicator,value,hint);
  if(result) provider='gemini-google-search';
  if(!result){
    result=await auditWithOpenAI(indicator,value,hint);
    if(result) provider='openai-web';
  }
  if(!result) throw new Error('Agente de validação não configurado. Defina GEMINI_API_KEY ou OPENAI_API_KEY no Render.');

  const parsed=result.data;
  if(!parsed||typeof parsed!=='object') throw new Error('O agente não retornou uma auditoria estruturada.');

  const score=clampScore(parsed.score);
  const verdict=normalizeVerdict(parsed.verdict);
  const citations=result.citations||[];
  const grounded=chooseGroundedSource(parsed,citations);
  const sourceUrl=cleanUrl(grounded.url)||null;
  const official=isOfficialUrl(sourceUrl||'');
  const criteria={...(parsed.criteria||{})};
  if(criteria.sourceOfficial==null && sourceUrl) criteria.sourceOfficial=official;
  if(citations.length && !grounded.exactCitation && parsed.sourceUrl){
    criteria.traceableEvidence=false;
  }

  const rawPayload={
    auditType:'SOURCE_ABNT_COMPATIBILITY',
    provider,
    model:result.model,
    interactionId:result.interactionId,
    searchQueries:result.queries||[],
    groundingCitations:citations,
    verdict,
    score,
    summary:String(parsed.summary||'').slice(0,1800),
    criteria,
    issues:Array.isArray(parsed.issues)?parsed.issues.map(x=>String(x).slice(0,500)).slice(0,12):[],
    recommendation:String(parsed.recommendation||'').slice(0,1800),
    recalculatedValue:parsed.recalculatedValue==null?null:String(parsed.recalculatedValue).slice(0,200),
    auditedValueId:value.id,
    auditedOrigin:value.origin||null,
    currentSource:currentSource(value),
  };

  const item=await prisma.agentFinding.create({
    data:{
      indicatorId:indicator.id,
      targetField:'SOURCE_AUDIT',
      candidateValueRaw:value.finalRaw||value.numeratorRaw||value.denominatorRaw||null,
      candidateValueNumber:value.finalNumber??value.numeratorNumber??value.denominatorNumber??null,
      unit:indicator.unit||null,
      referenceYear:parsed.referenceYear?String(parsed.referenceYear):value.finalYear||value.numeratorYear||value.denominatorYear||null,
      sourceName:String(grounded.title||value.finalSource||value.numeratorSource||value.denominatorSource||'Fonte auditada').slice(0,300),
      sourceOrganization:parsed.sourceOrganization?String(parsed.sourceOrganization).slice(0,300):null,
      sourceType:official?'Fonte oficial auditada':'Fonte auditada',
      sourceUrl,
      evidenceExcerpt:parsed.evidenceExcerpt?String(parsed.evidenceExcerpt).slice(0,2400):null,
      confidenceLevel:confidence(score),
      confidenceScore:score,
      confidenceReason:String(parsed.summary||parsed.recommendation||'Auditoria técnica concluída.').slice(0,900),
      status:'IN_REVIEW',
      rawPayload,
    },
  });

  if(sourceUrl||parsed.evidenceExcerpt){
    await prisma.evidence.create({
      data:{
        indicatorId:indicator.id,
        findingId:item.id,
        title:`Auditoria de fonte · ${indicator.code}`,
        organization:parsed.sourceOrganization?String(parsed.sourceOrganization).slice(0,300):null,
        url:sourceUrl,
        excerpt:parsed.evidenceExcerpt?String(parsed.evidenceExcerpt).slice(0,2400):null,
        accessedAt:new Date(),
        notes:`Veredito técnico: ${verdict} · score ${score} · provedor ${provider}`,
      },
    });
  }
  await prisma.indicatorHistory.create({
    data:{
      indicatorId:indicator.id,
      action:'SOURCE_ABNT_AUDIT',
      actor:`Agente de validação (${provider})`,
      details:{findingId:item.id,verdict,score,sourceUrl,provider,model:result.model,citations:citations.length},
    },
  });
  return {...item,rawPayload};
}

export async function auditNextBatch({standard=null,limit=5}={}){
  const take=Math.max(1,Math.min(10,Number(limit)||5));
  const where={
    ...(standard?{standard:{code:String(standard)}}:{}),
    values:{some:{isCurrent:true}},
    status:{in:['COMPLETE','AWAITING_VALIDATION','PARTIAL','VALIDATED','REVIEW_NEEDED']},
  };
  const candidates=await prisma.indicator.findMany({
    where,
    include:{
      standard:true,
      values:{where:{isCurrent:true},take:1,orderBy:{createdAt:'desc'}},
      findings:{where:{targetField:'SOURCE_AUDIT'},orderBy:{createdAt:'desc'},take:1},
    },
    orderBy:[{priority:'desc'},{updatedAt:'asc'}],
    take:60,
  });
  const queue=candidates.sort((a,b)=>{
    const av=a.findings?.[0]?.createdAt?new Date(a.findings[0].createdAt).getTime():0;
    const bv=b.findings?.[0]?.createdAt?new Date(b.findings[0].createdAt).getTime():0;
    return av-bv;
  }).slice(0,take);

  const results=[];
  for(const indicator of queue){
    try{
      const audit=await auditIndicatorSource(indicator.id);
      results.push({indicatorId:indicator.id,code:indicator.code,ok:true,verdict:audit.rawPayload?.verdict,score:audit.confidenceScore,provider:audit.rawPayload?.provider});
    }catch(error){
      results.push({indicatorId:indicator.id,code:indicator.code,ok:false,error:error.message});
      if(/não configurado/i.test(error.message)) break;
    }
  }
  return {checked:results.length,results};
}
