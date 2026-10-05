import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { auditIndicatorSource, auditNextBatch } from '../services/sourceAudit.js';

export const validationRouter = Router();

function originLabel(value){
  const origin=String(value?.origin||'').toUpperCase();
  if(origin==='GETERR') return 'Geterr';
  if(origin==='VICOSA_SMART') return 'Viçosa SMART';
  if(origin==='AGENT') return 'Agente';
  if(origin==='MANUAL') return 'Manual';
  return value?.sourceLabel||'Não informado';
}
function sourceName(value){
  const external = value?.finalSource || value?.numeratorSource || value?.denominatorSource || null;
  if (external) return external;
  return null;
}
function sourceUrl(value){
  return value?.finalSourceUrl||value?.numeratorSourceUrl||value?.denominatorSourceUrl||null;
}
function normalizeAudit(f){
  if(!f) return null;
  const p=f.rawPayload&&typeof f.rawPayload==='object'?f.rawPayload:{};
  return {
    id:f.id,
    verdict:p.verdict||'INCONCLUSIVE',
    score:f.confidenceScore||p.score||0,
    summary:p.summary||f.confidenceReason||'',
    criteria:p.criteria||{},
    issues:Array.isArray(p.issues)?p.issues:[],
    recommendation:p.recommendation||'',
    recalculatedValue:p.recalculatedValue||null,
    sourceName:f.sourceName,
    sourceOrganization:f.sourceOrganization,
    sourceUrl:f.sourceUrl,
    evidenceExcerpt:f.evidenceExcerpt,
    referenceYear:f.referenceYear,
    createdAt:f.createdAt,
  };
}

validationRouter.get('/', async (req,res,next)=>{
  try{
    const {standard='',origin='',verdict='',q=''}=req.query;
    const items=await prisma.indicator.findMany({
      where:{
        ...(standard?{standard:{code:String(standard)}}:{}),
        values:{some:{isCurrent:true}},
        ...(q?{OR:[
          {code:{contains:String(q),mode:'insensitive'}},
          {name:{contains:String(q),mode:'insensitive'}},
        ]}:{}),
      },
      include:{
        standard:true,
        values:{where:{isCurrent:true},take:1,orderBy:{createdAt:'desc'}},
        findings:{where:{targetField:'SOURCE_AUDIT'},take:1,orderBy:{createdAt:'desc'}},
      },
      orderBy:[{standard:{code:'asc'}},{sourceRow:'asc'}],
      take:500,
    });

    let rows=items.map(i=>{
      const currentValue=i.values[0]||null;
      const audit=normalizeAudit(i.findings?.[0]||null);
      return {
        id:i.id,
        code:i.code,
        name:i.name,
        status:i.status,
        unit:i.unit,
        standard:i.standard,
        currentValue,
        foundAt:originLabel(currentValue),
        sourceName:sourceName(currentValue),
        sourceProven: Boolean(sourceName(currentValue)),
        sourceUrl:sourceUrl(currentValue),
        audit,
      };
    });
    if(origin) rows=rows.filter(i=>String(i.currentValue?.origin||'').toUpperCase()===String(origin).toUpperCase());
    if(verdict==='PENDING') rows=rows.filter(i=>!i.audit);
    else if(verdict) rows=rows.filter(i=>i.audit?.verdict===verdict);

    const allAudits=await prisma.agentFinding.findMany({
      where:{targetField:'SOURCE_AUDIT'},
      select:{indicatorId:true,rawPayload:true,confidenceScore:true,createdAt:true},
      orderBy:{createdAt:'desc'},
    });
    const latest=new Map();
    for(const a of allAudits) if(!latest.has(a.indicatorId)) latest.set(a.indicatorId,a);
    const summary={pending:0,audited:0,adequate:0,partial:0,inadequate:0,inconclusive:0};
    for(const row of items){
      const a=latest.get(row.id);
      if(!a){summary.pending++;continue;}
      summary.audited++;
      const v=(a.rawPayload&&typeof a.rawPayload==='object'&&a.rawPayload.verdict)||'INCONCLUSIVE';
      if(v==='ADEQUATE') summary.adequate++;
      else if(v==='PARTIAL') summary.partial++;
      else if(v==='INADEQUATE') summary.inadequate++;
      else summary.inconclusive++;
    }

    res.json({
      configured:Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
      provider:process.env.GEMINI_API_KEY?'Gemini + Google Search':process.env.OPENAI_API_KEY?'OpenAI + pesquisa web':'Não configurado',
      model:process.env.GEMINI_API_KEY?(process.env.GEMINI_MODEL||'gemini-2.5-flash'):process.env.OPENAI_API_KEY?(process.env.OPENAI_MODEL||'gpt-5.6-sol'):null,
      total:rows.length,
      summary,
      items:rows,
    });
  }catch(error){next(error);}
});

validationRouter.post('/run',async(req,res,next)=>{
  try{
    const standard=req.body?.standard?String(req.body.standard):null;
    const limit=req.body?.limit||5;
    res.json(await auditNextBatch({standard,limit}));
  }catch(error){next(error);}
});

validationRouter.post('/:id/run',async(req,res,next)=>{
  try{
    const hint=req.body?.hint?String(req.body.hint).slice(0,2000):null;
    res.json(await auditIndicatorSource(req.params.id,{hint}));
  }catch(error){next(error);}
});
