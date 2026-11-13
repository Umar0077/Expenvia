import { getTranslations } from "next-intl/server";
import { Clock3, Mail, MapPin, Phone } from "lucide-react";
export async function BranchContact({branch}:{branch:{address:string|null;contactPhone:string|null;secondaryPhone:string|null;contactEmail:string|null;workingDays:string|null;opensAt:string|null;closesAt:string|null;timezone:string|null}}) {
 const t=await getTranslations("branches");
 return <div className="atelier-branch-contact">
  <p className="flex items-start gap-2"><MapPin className="mt-1 size-4 shrink-0"/><span>{branch.address||t("awaitingAddress")}</span></p>
  <div className="flex items-start gap-2"><Phone className="mt-1 size-4 shrink-0"/><span>{branch.contactPhone?<><a className="ltr-data hover:text-brand" href={`tel:${branch.contactPhone.replace(/[\s-]/g,"")}`}>{branch.contactPhone}</a>{branch.secondaryPhone&&<><br/><a className="ltr-data hover:text-brand" href={`tel:${branch.secondaryPhone.replace(/[\s-]/g,"")}`}>{branch.secondaryPhone}</a></>}</>:t("awaitingPhone")}</span></div>
  <p className="flex items-start gap-2"><Mail className="mt-1 size-4 shrink-0"/>{branch.contactEmail?<a className="ltr-data hover:text-brand" href={`mailto:${branch.contactEmail}`}>{branch.contactEmail}</a>:t("awaitingEmail")}</p>
  <p className="flex items-start gap-2"><Clock3 className="mt-1 size-4 shrink-0"/><span>{branch.workingDays&&branch.opensAt&&branch.closesAt?<>{t("monFri")} · <bdi>{branch.opensAt}–{branch.closesAt}</bdi>{branch.closesAt<branch.opensAt&&<> · {t("nextDay")}</>}</>:t("awaitingSchedule")}<br/>{branch.timezone&&<span className="ltr-data text-xs">{branch.timezone}</span>}</span></p>
 </div>;
}
