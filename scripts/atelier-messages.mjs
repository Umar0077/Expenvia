import { readFileSync, writeFileSync } from "node:fs";
for(const locale of ["en","ur"]) {
 const path=`messages/${locale}/org.json`,data=JSON.parse(readFileSync(path,"utf8"));
 Object.assign(data.branches,locale==="en"?{
  secondaryPhone:"Additional phone",timezone:"Timezone",workingDays:"Working days",opensAt:"Opening time",closesAt:"Closing time",monFri:"Monday–Friday",nextDay:"next day",overnightHint:"A closing time earlier than opening ends the next day.",awaitingAddress:"Street address awaiting confirmation",awaitingPhone:"Phone awaiting confirmation",awaitingEmail:"Email awaiting confirmation",awaitingSchedule:"Office hours awaiting confirmation"
 }:{secondaryPhone:"اضافی فون",timezone:"ٹائم زون",workingDays:"کام کے دن",opensAt:"کھلنے کا وقت",closesAt:"بند ہونے کا وقت",monFri:"پیر تا جمعہ",nextDay:"اگلے دن",overnightHint:"اگر بند ہونے کا وقت پہلے ہو تو دفتر اگلے دن بند ہوتا ہے۔",awaitingAddress:"مکمل پتے کی تصدیق باقی ہے",awaitingPhone:"فون کی تصدیق باقی ہے",awaitingEmail:"ای میل کی تصدیق باقی ہے",awaitingSchedule:"دفتری اوقات کی تصدیق باقی ہے"});
 writeFileSync(path,JSON.stringify(data,null,2)+"\n");
}
