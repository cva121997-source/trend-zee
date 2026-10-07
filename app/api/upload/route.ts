import {isAdmin,checkOrigin,uploadProductImage} from '@/lib/store-server';

export async function POST(req:Request){
  try{
    checkOrigin(req);
    if(!await isAdmin(req)) return Response.json({error:'Admin sign-in required.'},{status:401});
    const body=await req.formData();
    const file=body.get('file');
    if(!(file instanceof File)||file.size>5*1024*1024) throw new Error('Choose an image smaller than 5 MB.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
    const webp=new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
    if(!jpeg&&!png&&!webp) throw new Error('Use a JPG, PNG or WebP image.');
    const key=crypto.randomUUID();
    const url=await uploadProductImage(key,bytes,jpeg?'image/jpeg':png?'image/png':'image/webp');
    return Response.json({url:'/api/image/'+key,storageUrl:url});
  }catch(e){
    return Response.json({error:e instanceof Error?e.message:'Upload failed.'},{status:400});
  }
}
