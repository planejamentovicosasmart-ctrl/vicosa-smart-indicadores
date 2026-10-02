import { prisma } from '../lib/prisma.js';
import { cleanUrl } from '../utils/indicator.js';

const OFFICIAL_HINTS = [
  'gov.br','ibge.gov.br','sidra.ibge.gov.br','datasus.gov.br','inep.gov.br',
  'tesouro.gov.br','aneel.gov.br','anatel.gov.br','mg.gov.br','vicosa.mg.gov.br',
  'saaevicosa.mg.gov.br','ufv.br','sinisa.gov.br','snis.gov.br','dados.gov.br',
];

function isOfficialUrl(url=''){
  const low=String(url).toLowerCase();
  return OFFICIAL_HINTS.some(d=>low.includes(d));
}
function extractOutputText(json){
  if(typeof json?.output_text==='string') return json.output_text;
  const chunks=[];
  for(const item of json?.output||[]) for(const content of item?.content||[]){
    if(typeof content?.text==='string') chunks.push(content.text);
  }
  return chunks.join('\n');
}
function parseJsonLoose(text){
  if(!text) return null;
  const clean=String(text).replace(/^\`\`\`(?:json)?/i,'').replace(/\`\`\`$/i,'').trim();
  try{return JSON.parse(clean);}catch{}
  const start=Math.min(...['{','['].map(x=>clean.indexOf(x)).filter(i=>i>=0));
  if(!Number.isFinite(start)) return null;
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

export async function auditIndicatorSource(indicatorId,{hint=null}={}){
  const indicator=await prisma.indicator.findUnique({
    where:{id:indicatorId},
    include:{
      standard:true,
      values:{where:{isCurrent:true},take:1,orderBy:{createdAt:'desc'}},
    },
  });
  if(!indicator) throw new Error('Indicador não encontrado');
  const value=indicator.values?.[0]||null;
  if(!value) throw new Error('Este indicador ainda não possui dado/fonte para auditar');

  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) throw new Error('Agente de validação não configurado. Defina OPENAI_API_KEY no Render.');
  const model=process.env.OPENAI_MODEL||'gpt-5.6-sol';

  const existing=currentSource(value);
  const system=`Você é um auditor técnico de evidências para indicadores municipais das ABNT NBR ISO 37120, 37122 e 37123. 
Sua tarefa NÃO é certificar conformidade ABNT e NÃO é aprovar dados automaticamente. Sua tarefa é avaliar se a fonte e o dado apresentado são tecnicamente adequados para sustentar o indicador cadastrado no sistema.

Regras obrigatórias:
1. Use pesquisa web. Priorize fonte oficial, institucional, primária e rastreável.
2. Não invente valores, URLs, anos, páginas, fórmulas ou trechos.
3. Verifique se a fonte se refere a Viçosa/MG e ao período informado.
4. Compare o conceito da fonte com o nome, descrição, numerador, denominador, unidade e fórmula cadastrados.
5. Uma fonte sobre tema parecido NÃO basta. Ela precisa sustentar exatamente o componente ou resultado usado.
6. Se houver numerador e denominador, confira compatibilidade temporal e semântica; quando possível, recalcule o resultado.
7. Se o dado for zero, exija evidência positiva de ausência/zero; não aceite ausência de registro como prova de zero.
8. Se a fonte for secundária, planilha interna ou agregador, procure a fonte primária.
9. Se não houver evidência suficiente, use INCONCLUSIVE.
10. O veredito é técnico: ADEQUATE, PARTIAL, INADEQUATE ou INCONCLUSIVE.

Critérios a avaliar (boolean ou null quando não verificável): sourceOfficial, sourcePrimary, municipalityMatch, yearMatch, conceptMatch, numeratorMatch, denominatorMatch, unitMatch, calculationMatch, traceableEvidence.

Retorne SOMENTE JSON válido:
{
 "verdict":"ADEQUATE|PARTIAL|INADEQUATE|INCONCLUSIVE",
 "score":0-100,
 "summary":"resumo objetivo",
 "sourceName":"melhor fonte verificada",
 "sourceOrganization":"órgão",
 "sourceUrl":"URL exata",
 "referenceYear":"ano/período",
 "evidenceExcerpt":"trecho curto que sustenta a análise",
 "criteria":{
   "sourceOfficial":true|false|null,
   "sourcePrimary":true|false|null,
   "municipalityMatch":true|false|null,
   "yearMatch":true|false|null,
   "conceptMatch":true|false|null,
   "numeratorMatch":true|false|null,
   "denominatorMatch":true|false|null,
   "unitMatch":true|false|null,
   "calculationMatch":true|false|null,
   "traceableEvidence":true|false|null
 },
 "issues":["problema objetivo"],
 "recommendation":"o que falta conferir/obter antes de usar como evidência ABNT",
 "recalculatedValue":"valor recalculado, se aplicável, senão null"
}`;

  const user=`Município: Viçosa/MG
Norma: ABNT NBR ISO ${indicator.standard.code}
Código: ${indicator.code}
Indicador: ${indicator.name}
Descrição cadastrada: ${indicator.description||'não informada'}
Numerador exigido/cadastrado: ${indicator.numeratorDescription||'não informado'}
Denominador exigido/cadastrado: ${indicator.denominatorDescription||'não informado'}
Unidade cadastrada: ${indicator.unit||'não informada'}
Fórmula cadastrada: ${indicator.formula||value.finalFormula||'não informada'}
Dado/fonte atual: ${JSON.stringify(existing)}
Observações: ${indicator.notes||'nenhuma'}
Pista adicional do usuário: ${hint||'nenhuma'}

Pesquise e audite a evidência. Diga se a fonte realmente serve para sustentar ESTE indicador, não apenas se a fonte é confiável.`;

  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      model,
      tools:[{type:'web_search'}],
      input:[
        {role:'system',content:[{type:'input_text',text:system}]},
        {role:'user',content:[{type:'input_text',text:user}]},
      ],
    }),
  });
  const json=await response.json();
  if(!response.ok) throw new Error(`OpenAI: ${json?.error?.message||response.statusText}`);
  const parsed=parseJsonLoose(extractOutputText(json));
  if(!parsed||typeof parsed!=='object') throw new Error('O agente não retornou uma auditoria estruturada.');

  const score=clampScore(parsed.score);
  const verdict=normalizeVerdict(parsed.verdict);
  const sourceUrl=cleanUrl(parsed.sourceUrl)||null;
  const official=isOfficialUrl(sourceUrl||'');
  const criteria={...(parsed.criteria||{})};
  if(criteria.sourceOfficial==null && sourceUrl) criteria.sourceOfficial=official;

  const rawPayload={
    auditType:'SOURCE_ABNT_COMPATIBILITY',
    verdict,
    score,
    summary:String(parsed.summary||'').slice(0,1800),
    criteria,
    issues:Array.isArray(parsed.issues)?parsed.issues.map(x=>String(x).slice(0,500)).slice(0,12):[],
    recommendation:String(parsed.recommendation||'').slice(0,1800),
    recalculatedValue:parsed.recalculatedValue==null?null:String(parsed.recalculatedValue).slice(0,200),
    auditedValueId:value.id,
    auditedOrigin:value.origin||null,
    currentSource:existing,
  };

  const item=await prisma.agentFinding.create({
    data:{
      indicatorId:indicator.id,
      targetField:'SOURCE_AUDIT',
      candidateValueRaw:value.finalRaw||value.numeratorRaw||value.denominatorRaw||null,
      candidateValueNumber:value.finalNumber??value.numeratorNumber??value.denominatorNumber??null,
      unit:indicator.unit||null,
      referenceYear:parsed.referenceYear?String(parsed.referenceYear):value.finalYear||value.numeratorYear||value.denominatorYear||null,
      sourceName:String(parsed.sourceName||value.finalSource||value.numeratorSource||value.denominatorSource||'Fonte auditada').slice(0,300),
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
        notes:`Veredito técnico: ${verdict} · score ${score}`,
      },
    });
  }
  await prisma.indicatorHistory.create({
    data:{
      indicatorId:indicator.id,
      action:'SOURCE_ABNT_AUDIT',
      actor:'Agente de validação',
      details:{findingId:item.id,verdict,score,sourceUrl},
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
  const queue=candidates
    .sort((a,b)=>{
      const av=a.findings?.[0]?.createdAt?new Date(a.findings[0].createdAt).getTime():0;
      const bv=b.findings?.[0]?.createdAt?new Date(b.findings[0].createdAt).getTime():0;
      return av-bv;
    })
    .slice(0,take);

  const results=[];
  for(const indicator of queue){
    try{
      const audit=await auditIndicatorSource(indicator.id);
      results.push({indicatorId:indicator.id,code:indicator.code,ok:true,verdict:audit.rawPayload?.verdict,score:audit.confidenceScore});
    }catch(error){
      results.push({indicatorId:indicator.id,code:indicator.code,ok:false,error:error.message});
      if(/não configurado/i.test(error.message)) break;
    }
  }
  return {checked:results.length,results};
}
