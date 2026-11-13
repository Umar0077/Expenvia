import "dotenv/config";
import { db } from "../src/server/db";
import { importCompanyBranches } from "../src/server/services/branch-import";
if (!['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname) || /demo|test/.test(new URL(process.env.DATABASE_URL!).pathname)) throw new Error("Use the local application database, not demo/test");
try {
 const admin=await db.user.findFirst({where:{role:"SUPER_ADMIN",status:"ACTIVE"},orderBy:{createdAt:"asc"}});
 if(!admin) throw new Error("An active Super Admin is required");
 const history=()=>Promise.all([db.expense.count(),db.invoice.count(),db.invoicePayment.count(),db.userBranchAssignment.count(),db.vendorBranchAssignment.count()]);
 const before=await history();
 const result=await importCompanyBranches({userId:admin.id,sessionId:"local-administrative-import",role:"SUPER_ADMIN",fullName:admin.fullName,email:admin.email});
 const after=await history();if(JSON.stringify(before)!==JSON.stringify(after))throw new Error("Unexpected history change");
 console.log(JSON.stringify({result,historyPreserved:after}));
} finally {await db.$disconnect();}
