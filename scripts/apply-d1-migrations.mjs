import {execFileSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';

const database=process.env.D1_DATABASE_NAME;
if(!database)throw new Error('D1_DATABASE_NAME is required.');
const dir=join(process.cwd(),'drizzle');
const files=readdirSync(dir).filter(name=>/^\d+_.*\.sql$/.test(name)).sort();
if(!files.length)throw new Error('No D1 migrations found in drizzle/.');
for(const file of files){
  console.log('Applying',file);
  execFileSync('npx',['wrangler','d1','execute',database,'--remote','--yes','--file',join(dir,file)],{stdio:'inherit',env:process.env});
}
console.log('Applied',files.length,'D1 migration files.');
