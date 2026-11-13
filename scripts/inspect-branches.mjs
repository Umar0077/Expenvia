import "dotenv/config";
import pg from "pg";
for(const [name,url] of Object.entries({application:process.env.DATABASE_URL,demo:process.env.DEMO_DATABASE_URL})) {
 const client=new pg.Client({connectionString:url});await client.connect();
 try {
  const rows=await client.query(`SELECT b.id,b.code,b.name,b.city,b.address,b.status,
   (SELECT count(*) FROM expenses e WHERE e.branch_id=b.id) expenses,
   (SELECT count(*) FROM invoices i WHERE i.branch_id=b.id) invoices,
   (SELECT count(*) FROM user_branch_assignments a WHERE a.branch_id=b.id AND ended_at IS NULL) employees,
   (SELECT count(*) FROM vendor_branch_assignments a WHERE a.branch_id=b.id AND removed_at IS NULL) vendors FROM branches b ORDER BY b.code`);
  console.log(name,JSON.stringify(rows.rows));
 }finally{await client.end();}
}
