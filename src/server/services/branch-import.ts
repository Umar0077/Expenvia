import "server-only";
import { db } from "@/server/db";
import { branchSchema } from "@/lib/validation/org";
import type { Actor } from "@/server/auth/session";

const shared = {country:"Pakistan", timezone:"Asia/Karachi"};
const confirmed = {...shared,contactEmail:"humanresource@balitech.org",workingDays:"MON_FRI" as const,opensAt:"18:00",closesAt:"04:00"};
export const companyBranches = [
 { ...confirmed, code:"SHAMSABAD",name:"Shamsabad Office",city:"Rawalpindi",address:"Office 8, 1st Floor, Maryam Business Centre, Murree Road, Shamsabad, Rawalpindi, Punjab 4400",contactPhone:"0331-8638312",secondaryPhone:"0333-8513359" },
 { ...confirmed, code:"ISB-I93",name:"Islamabad Office",city:"Islamabad",address:"Plot No. 349-352, Street No. 1, Industrial Area I-9/3, Islamabad",contactPhone:"03700039073" },
 { ...confirmed, code:"COMMERCIAL",name:"Commercial Office",city:"Rawalpindi",address:"Office No. 1, 3rd Floor, Satellite Town B Block, Ideas Building Plaza, Rawalpindi",contactPhone:"03700039070",secondaryPhone:"03000039071" },
 { ...confirmed, code:"IRAN-ROAD",name:"Iran Road Office",city:"Rawalpindi",address:"Plaza No. A-74, Iran Road, Satellite Town-A, Rawalpindi, Punjab, Pakistan",contactPhone:"0370 0585660",secondaryPhone:"0327 1233435" },
 { ...shared, code:"ISB-I92",name:"I-9/2 Office",city:"Islamabad" },
];

/** Validated, authorized, atomic import; existing identity/history is retained. */
export async function importCompanyBranches(actor: Actor) {
 if(actor.role!=="SUPER_ADMIN") throw new Error("Super Admin required");
 return db.$transaction(async tx=>{
  const admin=await tx.user.findUnique({where:{id:actor.userId}});
  if(admin?.role!=="SUPER_ADMIN" || admin.status!=="ACTIVE") throw new Error("Active Super Admin required");
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(82131301)::text`;
  const results=[];
  for(const input of companyBranches) {
   const parsed=branchSchema.parse(input);
   const matches=await tx.branch.findMany({where:{OR:[{code:{equals:input.code,mode:"insensitive"}},{name:{equals:input.name,mode:"insensitive"},city:{equals:input.city,mode:"insensitive"}}]}});
   if(matches.length>1) throw new Error(`Ambiguous branch: ${input.code}`);
   const existing=matches[0];
   if(existing && (existing.name.toLowerCase()!==input.name.toLowerCase() || existing.city.toLowerCase()!==input.city.toLowerCase())) throw new Error(`Identity conflict: ${input.code}`);
   // Only supplied fields are updated; absent I-9/2 details never erase existing data.
   const data=Object.fromEntries(Object.keys(input).filter(k=>k!=="code").map(k=>[k,parsed[k as keyof typeof parsed]]));
   const changed=!existing || Object.entries(data).some(([k,v])=>(existing as unknown as Record<string,unknown>)[k]!==v);
   const branch=existing ? changed ? await tx.branch.update({where:{id:existing.id},data}) : existing : await tx.branch.create({data:{...parsed,createdById:actor.userId}});
   if(changed) await tx.auditLog.create({data:{actorId:actor.userId,actorRole:"SUPER_ADMIN",action:existing?"branch.import_updated":"branch.import_created",entityType:"branch",entityId:branch.id,branchId:branch.id,summary:{source:"company-offices-2026-11",code:branch.code,fields:Object.keys(input)}}});
   results.push({code:branch.code,id:branch.id,result:existing?changed?"updated":"matched":"created"});
  }
  return results;
 });
}
