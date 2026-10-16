import QRCode from 'qrcode-svg';
import JSZip from 'jszip';

const SIZE = 256, GAP = 8, LABEL_HEIGHT = 12;
export function qrSvg(url, shortCode) {
  const label = String(shortCode).replace(/[&<>"']/g, v => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[v]));
  const svg = new QRCode({ content:url, width:SIZE, height:SIZE }).svg();
  const rects = [...svg.matchAll(/<rect[^>]*y="([\d.]+)"[^>]*height="([\d.]+)"[^>]*style="fill:#000000/gi)];
  const bottom = rects.length ? Math.max(...rects.map(([,y,h])=>Number(y)+Number(h))) : SIZE-24;
  const top = Math.ceil(bottom+GAP), total=top+LABEL_HEIGHT;
  return svg.replace('height="256"', 'height="'+total+'"')
    .replace('<rect x="0" y="0" width="256" height="256"', '<rect x="0" y="0" width="256" height="'+total+'"')
    .replace('</svg>', '<text x="128" y="'+(top+LABEL_HEIGHT/2)+'" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-size="9" letter-spacing="0.4" fill="#222222">'+label+'</text></svg>');
}
export async function qrZip(batch, codes, origin) {
  const zip=new JSZip();
  const lines=['batch_code,short_code,quantity,qr_url,file'];
  for (const code of codes) {
    const url=origin+'/q/'+code.short_code;
    const file=batch.batch_code+'-'+code.short_code+'.svg';
    zip.file(file, qrSvg(url,code.short_code));
    lines.push([batch.batch_code,code.short_code,batch.qr_mode==='SHARED'?batch.quantity:1,url,file].join(','));
  }
  zip.file('mapping.csv',lines.join('\r\n')+'\r\n');
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:4}});
}
