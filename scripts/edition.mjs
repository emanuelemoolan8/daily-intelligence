import fs from 'node:fs';
import vm from 'node:vm';
export function readEdition(date) {
 if(!date){
  const pointer=fs.readFileSync('editions/latest.js','utf8');
  date=pointer.match(/editions\/(\d{4}-\d{2}-\d{2})\.js/)?.[1];
 }
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw Error('Expected edition date YYYY-MM-DD');
 const sandbox={window:{}};
 vm.runInNewContext(fs.readFileSync(`editions/${date}.js`,'utf8'),sandbox,{timeout:1000});
 const data=sandbox.window.DI_EDITION_DATA;
 if(data.date!==date)throw Error('Edition metadata date does not match filename');
 return {date,data};
}
