<script setup>
import { ref, onMounted, computed } from 'vue';
import zhCn from 'element-plus/es/locale/lang/zh-cn.mjs';
import en from 'element-plus/es/locale/lang/en.mjs';
import pt from 'element-plus/es/locale/lang/pt.mjs';
import fr from 'element-plus/es/locale/lang/fr.mjs';
import de from 'element-plus/es/locale/lang/de.mjs';
import it from 'element-plus/es/locale/lang/it.mjs';
import ja from 'element-plus/es/locale/lang/ja.mjs';
import ko from 'element-plus/es/locale/lang/ko.mjs';
import nl from 'element-plus/es/locale/lang/nl.mjs';
import es from 'element-plus/es/locale/lang/es.mjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import { locale, languages, t } from './i18n.js';
const elementLocale=computed(()=>({'zh-CN':zhCn,en,pt,fr,de,it,ja,ko,nl,es})[locale.value]||en);
const view=ref(window.location.hash.startsWith('#/admin')?'loading':'public'),tab=ref('home'),loading=ref(false);
const previewVisible=ref(false),previewRow=ref(null);
const passwordDialog=ref(false),oldPassword=ref(''),newPassword=ref(''),repeatPassword=ref(''),passwordBusy=ref(false);
const shortLink=computed(()=>previewRow.value?`${window.location.origin}/q/${previewRow.value.short_code}`:'');
const svgLink=computed(()=>previewRow.value?`/api/qrs/${previewRow.value.id}/qrcode.svg`:'');
function showPreview(row){previewRow.value=row;previewVisible.value=true;}
async function copyAndOpenShortLink(){
 // Open synchronously from user interaction so popup blockers do not intercept it.
 const popup=window.open(shortLink.value,'_blank','noopener,noreferrer');
 try{await navigator.clipboard.writeText(shortLink.value);ElMessage.success(t('copiedLink'));}
 catch{ElMessage.warning(t('copyFailed'));}
 if(!popup)ElMessage.info(t('popupBlocked'));
}
const page=ref({batches:1,qrs:1,locations:1}),pageSize=ref(5),publicSuccess=ref(false);
const adminSearch=ref({batches:'',qrs:'',locations:''});
const filtered=(items,key)=>{const q=adminSearch.value[key].trim().toLowerCase();return q?items.filter(item=>Object.values(item).some(v=>String(v??'').toLowerCase().includes(q))):items;};
const paged=(items,key)=>filtered(items,key).slice((page.value[key]-1)*pageSize.value,page.value[key]*pageSize.value);
const publicShort=ref(new URLSearchParams(location.search).get('code')||''),publicCode=ref(''),publicUrl=ref(''),publicBusy=ref(false),publicStep=ref(1),verifiedShort=ref('');
const email=ref(''),password=ref(''),setupToken=ref(''),confirm=ref('');
const user=ref(null),stats=ref({}),batches=ref([]),qrs=ref([]),locations=ref([]);
const cfUsage=ref(null),cfUsageLoading=ref(false);
async function refreshCloudflareUsage(){cfUsageLoading.value=true;try{cfUsage.value=await request('/api/cloudflare/usage');}catch{cfUsage.value={configured:false,errors:['UNAVAILABLE']};}finally{cfUsageLoading.value=false;}}
const quotaItems=computed(()=>[{key:'workersRequests',title:'quotaWorkers',limit:'100,000',unit:'quotaRequestsUnit'},{key:'d1RowsRead',title:'quotaD1Reads',limit:'5,000,000',unit:'quotaRowsUnit'},{key:'d1RowsWritten',title:'quotaD1Writes',limit:'100,000',unit:'quotaRowsUnit'},{key:'d1StorageBytes',title:'quotaD1Storage',limit:'5 GB',unit:'quotaTotalUnit'}]);
const fmtUsage=n=>typeof n==='number'?new Intl.NumberFormat(locale.value==='zh-CN'?'zh-CN':locale.value==='pt'?'pt-PT':locale.value==='en'?'en-US':locale.value).format(n):'—';
const batchName=ref(''),quantity=ref(10),qrMode=ref('UNIQUE');
const locationName=ref(''),locationRemark=ref('');
const selected=ref([]),locationId=ref(null),targetUrl=ref(''),targetType=ref('Website');
const request=async(path,options={})=>{
 const response=await fetch(path,{credentials:'same-origin',...options});
 const data=await response.json().catch(()=>({error:t('requestFailed')}));
 if(!response.ok)throw new Error(data.error||t('operationFailed'));
 return data;
};
const post=(path,payload,method='POST')=>request(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
async function lookupPublic(){
 publicSuccess.value=false;
 publicBusy.value=true;
 try{
  const code=publicShort.value.trim().toUpperCase();
  const data=await post('/public/lookup',{shortCode:code});
  if(!data.found){ElMessage.warning(t('lookupMissing'));return;}
  publicShort.value=code;verifiedShort.value=code;publicStep.value=2;
 }catch(e){ElMessage.error(t('lookupError'));}finally{publicBusy.value=false;}
}
function backToLookup(){publicStep.value=1;verifiedShort.value='';publicCode.value='';publicSuccess.value=false;publicUrl.value='';activationError.value='';}
const activationError=ref('');
function activationErrorText(code){
 const mapping={INVALID_SHORT_CODE:'errorShortCode',INVALID_URL:'errorInvalidUrl',INVALID_ACTIVATION_CODE:'errorInvalidCodeFormat',INVALID_CREDENTIALS:'errorInvalidCredentials',TOO_MANY_ATTEMPTS:'errorTooManyAttempts'};
 return t(mapping[code]||'errorActivationFailed');
}
async function submitPublic(){
 if(publicBusy.value||publicStep.value!==2||verifiedShort.value!==publicShort.value.trim().toUpperCase())return;
 activationError.value='';
 const activationCode=publicCode.value.trim().toUpperCase(),url=publicUrl.value.trim();
 if(!/^[A-HJ-NP-Z2-9]{16}$/.test(activationCode)){activationError.value=t('errorInvalidCodeFormat');return;}
 try {const target=new URL(url);if(!['http:','https:'].includes(target.protocol)||!target.hostname.includes('.')||target.username||target.password||url.length>2048){activationError.value=t('errorInvalidUrl');return;}}
 catch{activationError.value=t('errorInvalidUrl');return;}
 publicBusy.value=true;
 try{
  const response=await fetch('/public/activate',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({shortCode:verifiedShort.value,activationCode,targetUrl:url})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){activationError.value=activationErrorText(data.code);return;}
  publicCode.value='';publicSuccess.value=true;ElMessage.success({message:t('activationSuccess'),duration:5500});
 }catch{activationError.value=t('errorNetwork');}
 finally{publicBusy.value=false;}
}
async function openAdmin(){if(window.location.hash!=='#/admin'){window.location.hash='/admin';}else{view.value='loading';await bootstrap();}}
function backToPublic(){window.location.hash='/';view.value='public';}
function navigateHash(){if(window.location.hash.startsWith('#/admin')){view.value='loading';bootstrap();}else{view.value='public';}}

async function bootstrap(){
 try{
  const state=await request('/api/setup/status');
  if(!state.initialized){view.value='setup';return;}
  const auth=await request('/api/auth/me').catch(()=>null);
  if(auth?.user){user.value=auth.user;view.value='app';await load();}else view.value='login';
 }catch(e){view.value='error';ElMessage.error(e.message);}
}
async function submitAuth(){
 if(view.value==='setup'&&password.value!==confirm.value)return ElMessage.error(t('passwordMismatch'));
 loading.value=true;
 try{
  const result=await post(view.value==='setup'?'/api/setup/initialize':'/api/auth/login',view.value==='setup'?{setupToken:setupToken.value,email:email.value,password:password.value}:{email:email.value,password:password.value});
  user.value=result.user;password.value='';setupToken.value='';confirm.value='';window.location.hash='/admin';view.value='app';await load();
 }catch(e){ElMessage.error(e.message);}finally{loading.value=false;}
}
async function changePassword(){
 if(newPassword.value.length<12||newPassword.value.length>128)return ElMessage.error(t('passwordLength'));
 if(newPassword.value!==repeatPassword.value)return ElMessage.error(t('passwordMismatch'));
 passwordBusy.value=true;
 try{await post('/api/auth/change-password',{oldPassword:oldPassword.value,newPassword:newPassword.value});passwordDialog.value=false;oldPassword.value='';newPassword.value='';repeatPassword.value='';ElMessage.success(t('passwordChanged'));}
 catch{ElMessage.error(t('passwordChangeFailed'));}finally{passwordBusy.value=false;}
}
async function logout(){await post('/api/auth/logout',{});user.value=null;view.value='login';}
async function load(){
 try{
  const [s,b,q,l]=await Promise.all([request('/api/dashboard'),request('/api/batches'),request('/api/qrs'),request('/api/locations')]);
  stats.value=s;batches.value=b.items;qrs.value=q.items;locations.value=l.items;await refreshCloudflareUsage();
 }catch(e){ElMessage.error(e.message);}
}
async function createBatch(){
 try{
  await ElMessageBox.confirm(t('createBatchConfirm')+'：'+batchName.value+' / '+quantity.value+' / '+t(qrMode.value),t('createBatch'),{type:'warning'});
  await post('/api/batches',{batchName:batchName.value,quantity:Number(quantity.value),qrMode:qrMode.value});batchName.value='';await load();ElMessage.success(t('batchCreated'));}
 catch(e){if(e!=='cancel'&&e!=='close')ElMessage.error(e.message);}
}
async function addLocation(){
 try{await post('/api/locations',{name:locationName.value,remark:locationRemark.value});locationName.value='';locationRemark.value='';await load();ElMessage.success(t('locationCreated'));}
 catch(e){ElMessage.error(e.message);}
}
const choose=rows=>{selected.value=rows.map(r=>r.id);};
async function action(path,payload,successKey='success'){
 try{await post(path,payload);await load();ElMessage.success(t(successKey));}
 catch(e){ElMessage.error(e.message);}
}
async function assign(){if(!selected.value.length)return ElMessage.warning(t('selectQr'));await action('/api/qrs/bulk-assign',{ids:selected.value,locationId:locationId.value},'assignedSuccess');}
async function applyTarget(){if(!selected.value.length)return ElMessage.warning(t('selectQr'));await action('/api/qrs/bulk-target',{ids:selected.value,targetUrl:targetUrl.value,targetType:targetType.value},'urlSaved');}
async function activate(){if(!selected.value.length)return ElMessage.warning(t('selectQr'));await action('/api/qrs/bulk-activate',{ids:selected.value},'activatedSuccess');}
async function setStatus(row,status){
 try{
  await ElMessageBox.confirm(t(status==='ACTIVE'?'activateConfirm':'disableConfirm'),t(status==='ACTIVE'?'activate':'disable'));
  await action('/api/qrs/'+row.id+'/status',{status},status==='ACTIVE'?'activatedSuccess':'disabledSuccess');
 }catch(e){if(e!=='cancel' && e!=='close')ElMessage.error(e.message);}
}
async function production(row,status){
 try{
  await ElMessageBox.confirm(t(status==='PRINTED'?'confirmPrinted':'confirmShipped'),t('productionStatus'),{type:'warning'});
  await action('/api/batches/'+row.id+'/status',{status},'statusUpdated');
 }catch(e){if(e!=='cancel'&&e!=='close')ElMessage.error(e.message);}
}
function handleQrCommand(row,command){
 if(command==='url')return saveUrl(row);
 if(command==='code')return issueCode(row);
 if(command==='activate')return setStatus(row,'ACTIVE');
 if(command==='disable')return setStatus(row,'DISABLED');
}
async function saveUrl(row){
 try{
  const {value}=await ElMessageBox.prompt(t('enterUrl'),t('setTarget'),{inputValue:row.target_url||''});
  await request('/api/qrs/'+row.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetUrl:value,targetType:row.target_type||'Website'})});
  await load();
 }catch(e){if(e!=='cancel')ElMessage.error(e.message);}
}
async function saveLocation(row){
 try{
  const {value}=await ElMessageBox.prompt(t('enterLocation'),t('editLocation'),{inputValue:row.name});
  await request('/api/locations/'+row.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:value,remark:row.remark||''})});await load();
 }catch(e){if(e!=='cancel')ElMessage.error(e.message);}
}
async function bulkIssueCodes(){
 if(!selected.value.length)return ElMessage.warning(t('selectQr'));
 if(selected.value.length>100)return ElMessage.warning(t('bulkLimit'));
 try{
  await ElMessageBox.confirm(t('bulkCodeConfirm')+' ('+selected.value.length+')',t('bulkCodeTitle'),{type:'warning'});
  const response=await fetch('/api/qrs/bulk-activation-codes',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:selected.value})});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||t('operationFailed'));}
  const blob=await response.blob();
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='qr-activation-codes-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  ElMessage.success(t('bulkCodeSuccess'));
 }catch(e){if(e!=='cancel'&&e!=='close')ElMessage.error(e.message);}
}
async function issueCode(row){
 try {await ElMessageBox.confirm(t('issueCodeConfirm'),t('issueCodeTitle'));
 const data=await post('/api/qrs/'+row.id+'/activation-code',{});
 await ElMessageBox.alert(t('issueCodeNotice')+'\n'+data.activationCode,t('issueCodeTitle'),{confirmButtonText:'OK',dangerouslyUseHTMLString:false});
 }catch(e){if(e!=='cancel')ElMessage.error(e.message);}
}
async function deleteLocation(row){
 try{await ElMessageBox.confirm(t('deleteConfirm'),t('deleteLocation'));
 await request('/api/locations/'+row.id,{method:'DELETE'});await load();}
 catch(e){if(e!=='cancel')ElMessage.error(e.message);}
}
onMounted(()=>{document.title='QR Smart Link Lite';window.addEventListener('hashchange',navigateHash);if(window.location.hash.startsWith('#/admin'))bootstrap();});
</script>
<template>
 <el-config-provider :locale="elementLocale">
 <div v-if="view==='public'" class="public-page">
  <header class="public-header"><div class="public-brand"><span class="brand-mark">◇</span> QR Smart Link Lite</div><div class="line"><el-select v-model="locale" style="width:155px"><el-option v-for="l in languages" :key="l.value" :label="l.label" :value="l.value"/></el-select><el-button @click="openAdmin">{{t('adminEntry')}}</el-button></div></header>
  <main class="public-main"><section class="public-info"><span class="eyebrow">DYNAMIC QR • SELF-SERVICE</span><h1>{{t('publicTitle')}}</h1><p>{{t('publicDescription')}}</p><div class="step" v-for="(key,i) in ['stepOne','stepTwo','stepThree']" :key="key"><span class="step-num">{{i+1}}</span><div>{{t(key)}}</div></div></section><section class="public-form"><span class="eyebrow">QR SMART LINK</span><h2>{{t('activationTitle')}}</h2><p class="small">{{t('activationIntro')}}</p><div class="activation-progress">{{t('lookupStep')}} · {{publicStep}} / 2</div><el-form v-if="publicStep===1" label-position="top" @submit.prevent="lookupPublic"><el-form-item :label="t('publicShort')"><el-input v-model="publicShort" autocomplete="off" maxlength="16" :placeholder="t('lookupPlaceholder')"/></el-form-item><el-button type="primary" native-type="submit" :loading="publicBusy" class="activate-button">{{t('lookupButton')}}</el-button><p class="small">{{t('lookupHint')}}</p></el-form><div v-else-if="publicStep===2 && publicSuccess" class="activation-success"><span class="success-icon">✓</span><strong>{{t('successTitle')}}</strong><p>{{t('successDescription')}}</p><button type="button" class="success-reset" @click="backToLookup">{{t('successAnother')}}</button></div><el-form v-else-if="publicStep===2" label-position="top" @submit.prevent="submitPublic"><div class="found-short"><strong>{{t('lookupFound')}} · {{verifiedShort}}</strong><el-button text @click="backToLookup">{{t('lookupChange')}}</el-button></div><el-form-item :label="t('publicCode')"><el-input v-model="publicCode" type="password" show-password autocomplete="off" maxlength="16"/></el-form-item><el-form-item :label="t('publicUrl')"><el-input v-model="publicUrl" placeholder="https://"/></el-form-item><div v-if="activationError" class="activation-error" role="alert">{{activationError}}</div><el-button type="primary" native-type="submit" :loading="publicBusy" class="activate-button">{{t('publicSubmit')}}</el-button></el-form><p class="small">{{t('publicNotice')}}</p></section></main>
 </div>
 <div v-else-if="view==='loading'" class="panel">{{t('loading')}}</div>
 <div v-else-if="view==='error'" class="panel"><h2>{{t('unavailable')}}</h2><el-button @click="bootstrap">{{t('retry')}}</el-button></div>
 <div v-else-if="view==='setup'||view==='login'" class="panel login-card"><div class="login-decoration"><span class="login-symbol">◇</span><span>QR SMART LINK</span></div><div class="line"><el-select v-model="locale" style="width:165px"><el-option v-for="l in languages" :key="l.value" :label="l.label" :value="l.value"/></el-select></div>
  <h2>{{view==='setup'?t('setup'):t('loginTitle')}}</h2><p class="small">{{t('loginWelcome')}}</p>
  <el-form label-position="top" @submit.prevent="submitAuth">
   <el-form-item :label="t('email')"><el-input v-model="email" type="email" /></el-form-item>
   <el-form-item :label="t('password')"><el-input v-model="password" type="password" show-password /></el-form-item>
   <template v-if="view==='setup'">
    <el-form-item :label="t('confirmPassword')"><el-input v-model="confirm" type="password" show-password /></el-form-item>
    <el-form-item :label="t('setupToken')"><el-input v-model="setupToken" type="password" show-password /></el-form-item>
   </template>
   <el-button class="login-submit" type="primary" native-type="submit" :loading="loading" style="width:100%">{{view==='setup'?t('initialize'):t('login')}}</el-button>
  </el-form><el-button class="login-back" text @click="backToPublic">{{t('backToPublic')}}</el-button>
 </div>
 <div v-else class="layout admin-shell">
  <div class="top"><div><span class="admin-kicker">QR SMART LINK · CONTROL CENTER</span><h2>QR Smart Link Lite</h2><span class="small">Cloudflare · V0.1</span></div><div class="line"><el-select v-model="locale" style="width:165px"><el-option v-for="l in languages" :key="l.value" :label="l.label" :value="l.value"/></el-select> {{user?.email}} <el-button @click="passwordDialog=true">{{t('changePassword')}}</el-button> <el-button @click="logout">{{t('logout')}}</el-button></div></div>
  <el-menu mode="horizontal" :default-active="tab" class="nav" @select="v=>tab=v">
   <el-menu-item index="home">{{t('home')}}</el-menu-item><el-menu-item index="batches">{{t('batches')}}</el-menu-item><el-menu-item index="qrs">{{t('qrs')}}</el-menu-item><el-menu-item index="locations">{{t('locations')}}</el-menu-item>
  </el-menu>
  <div class="admin-toolbar"><div><strong>{{t(tab==='home'?'home':tab==='batches'?'batches':tab==='qrs'?'qrManagement':'locations')}}</strong></div><el-button @click="load">↻ {{t('refresh')}}</el-button></div>
  <template v-if="tab==='home'"><div class="metrics"><div class="metric">{{t('batches')}}<strong>{{stats.batches||0}}</strong></div><div class="metric">{{t('totalQrs')}}<strong>{{stats.codes||0}}</strong></div><div class="metric">{{t('pending')}}<strong>{{stats.pending||0}}</strong></div><div class="metric">{{t('active')}}<strong>{{stats.active||0}}</strong></div></div><section class="cloudflare-quota"><div class="quota-heading"><div><h3>{{t('cloudflareQuotaTitle')}}</h3><p class="small">{{t('cloudflareQuotaSubtitle')}}</p></div><a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer">{{t('cloudflareOpenDashboard')}} ↗</a></div><div class="quota-grid"><div v-for="item in quotaItems" :key="item.key" class="quota-card"><span>{{t(item.title)}}</span><strong>{{cfUsage?.plan==='free'?item.limit:t('quotaPlanUnknown')}}</strong><small>{{t(item.unit)}}</small><div class="quota-usage">{{t('quotaAccountUsage')}}：{{fmtUsage(cfUsage?.account?.[item.key])}}</div><div class="quota-usage">{{t('quotaProjectUsage')}}：{{fmtUsage(cfUsage?.project?.[item.key])}}</div><template v-if="cfUsage?.plan==='free'&&typeof cfUsage?.account?.[item.key]==='number'&&typeof cfUsage?.limits?.[item.key]==='number'"><small>{{t('quotaRemaining')}}：{{fmtUsage(Math.max(0,cfUsage.limits[item.key]-cfUsage.account[item.key]))}}</small><el-progress :percentage="Math.min(100,Math.round(10000*cfUsage.account[item.key]/cfUsage.limits[item.key])/100)" :stroke-width="7" :status="cfUsage.account[item.key]>=cfUsage.limits[item.key]*0.9?'exception':undefined"/></template></div></div><p class="quota-note">{{cfUsage?.configured?t('cloudflareUsageConnected'):t('cloudflareUsageNotConnected')}} {{t('cloudflareQuotaNote')}}</p><el-button size="small" :loading="cfUsageLoading" @click="refreshCloudflareUsage">{{t('refresh')}}</el-button></section></template>
  <template v-if="tab==='batches'">
   <div class="line"><el-input v-model="batchName" :placeholder="t('batchName')" /><el-input-number v-model="quantity" :min="1" :max="1000"/><el-radio-group v-model="qrMode"><el-radio value="UNIQUE">{{t('unique')}}</el-radio><el-radio value="SHARED">{{t('shared')}}</el-radio></el-radio-group><el-button type="primary" @click="createBatch">{{t('createBatch')}}</el-button></div>
   <div class="table-search"><el-input v-model="adminSearch.batches" clearable :placeholder="t('searchBatches')" @input="page.batches=1"/><span>{{filtered(batches,'batches').length}} {{t('records')}}</span></div><el-table :data="paged(batches,'batches')" stripe><el-table-column prop="batch_code" :label="t('batchCode')" min-width="170"/><el-table-column prop="batch_name" :label="t('name')"/><el-table-column prop="quantity" :label="t('quantity')" width="75"/><el-table-column :label="t('mode')" width="95"><template #default="{row}">{{t(row.qr_mode)}}</template></el-table-column><el-table-column :label="t('productionStatus')" width="120"><template #default="{row}">{{t(row.production_status)}}</template></el-table-column><el-table-column :label="t('actions')" min-width="240"><template #default="{row}"><a :href="'/api/batches/'+row.id+'/qrcodes.zip'">{{t('exportZip')}}</a> <el-button v-if="row.production_status==='CREATED'||row.production_status==='EXPORTED'" text @click="production(row,'PRINTED')">{{t('printed')}}</el-button><el-button v-else-if="row.production_status==='PRINTED'" text @click="production(row,'SHIPPED')">{{t('shipped')}}</el-button></template></el-table-column></el-table><div class="pagination-row"><el-pagination v-model:current-page="page.batches" :page-size="pageSize" :total="filtered(batches,'batches').length" layout="total, prev, pager, next, jumper" background/></div>
  </template>
  <template v-if="tab==='locations'">
<div class="line"><el-input v-model="locationName" :placeholder="t('locationName')"/><el-input v-model="locationRemark" :placeholder="t('remark')"/><el-button type="primary" @click="addLocation">{{t('addLocation')}}</el-button></div>
   <div class="table-search"><el-input v-model="adminSearch.locations" clearable :placeholder="t('searchLocations')" @input="page.locations=1"/><span>{{filtered(locations,'locations').length}} {{t('records')}}</span></div><el-table :data="paged(locations,'locations')" stripe><el-table-column prop="name" :label="t('name')"/><el-table-column prop="remark" :label="t('remark')"/><el-table-column prop="qr_count" :label="t('qrCount')" width="110"/><el-table-column :label="t('actions')" width="180"><template #default="{row}"><el-button text @click="saveLocation(row)">{{t('edit')}}</el-button><el-button text class="danger" @click="deleteLocation(row)">{{t('delete')}}</el-button></template></el-table-column></el-table><div class="pagination-row"><el-pagination v-model:current-page="page.locations" :page-size="pageSize" :total="filtered(locations,'locations').length" layout="total, prev, pager, next, jumper" background/></div>
  </template>
  <template v-if="tab==='qrs'">
   <p class="small admin-section-note">{{t('qrHelp')}}</p>
   <div class="line"><el-select v-model="locationId" :placeholder="t('selectLocation')" style="width:190px"><el-option v-for="l in locations" :key="l.id" :value="l.id" :label="l.name"/></el-select><el-button @click="assign">{{t('bulkAssign')}}</el-button><el-input v-model="targetUrl" :placeholder="t('targetPlaceholder')" class="wide" style="max-width:330px"/><el-input v-model="targetType" :placeholder="t('targetTypePlaceholder')" style="max-width:120px"/><el-button @click="applyTarget">{{t('bulkTarget')}}</el-button><el-button type="primary" @click="activate">{{t('bulkActivate')}}</el-button><el-button @click="bulkIssueCodes">{{t('bulkIssueCodes')}}</el-button></div>
   <div class="table-search"><el-input v-model="adminSearch.qrs" clearable :placeholder="t('searchQrs')" @input="page.qrs=1"/><span>{{filtered(qrs,'qrs').length}} {{t('records')}}</span></div><el-table :data="paged(qrs,'qrs')" @selection-change="choose" row-key="id" stripe><el-table-column type="selection" width="50"/><el-table-column prop="short_code" :label="t('shortCode')" width="110"/><el-table-column prop="batch_code" :label="t('batch')" min-width="145"/><el-table-column prop="location_name" :label="t('location')" min-width="130"/><el-table-column prop="target_url" :label="t('targetUrl')" min-width="160" show-overflow-tooltip/><el-table-column :label="t('status')" width="100"><template #default="{row}">{{t(row.status)}}</template></el-table-column><el-table-column :label="t('actions')" min-width="350"><template #default="{row}"><el-button text @click="showPreview(row)">{{t('preview')}}</el-button><el-button text @click="saveUrl(row)">{{t('urlAction')}}</el-button><el-button text @click="issueCode(row)">{{t('issueCode')}}</el-button><el-dropdown trigger="click" @command="cmd=>handleQrCommand(row,cmd)"><el-button text>{{t('more')}} <span aria-hidden="true">⋯</span></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="activate" :disabled="row.status==='ACTIVE'">{{t('activate')}}</el-dropdown-item><el-dropdown-item command="disable" :disabled="row.status==='DISABLED'">{{t('disable')}}</el-dropdown-item></el-dropdown-menu></template></el-dropdown></template></el-table-column></el-table><div class="pagination-row"><el-pagination v-model:current-page="page.qrs" :page-size="pageSize" :total="filtered(qrs,'qrs').length" layout="total, prev, pager, next, jumper" background/></div>
  </template>
 </div>
 <el-dialog v-model="passwordDialog" :title="t('changePassword')" width="420px" append-to-body><el-form label-position="top" @submit.prevent="changePassword"><el-form-item :label="t('oldPassword')"><el-input v-model="oldPassword" type="password" show-password autocomplete="current-password"/></el-form-item><el-form-item :label="t('newPassword')"><el-input v-model="newPassword" type="password" show-password autocomplete="new-password"/></el-form-item><el-form-item :label="t('repeatPassword')"><el-input v-model="repeatPassword" type="password" show-password autocomplete="new-password"/></el-form-item><p class="small">{{t('passwordLength')}}</p><el-button type="primary" native-type="submit" :loading="passwordBusy">{{t('confirmChange')}}</el-button><el-button @click="passwordDialog=false">{{t('closeDialog')}}</el-button></el-form></el-dialog>
 <el-dialog v-model="previewVisible" :title="t('previewDialogTitle')" width="520px" class="qr-preview-dialog" append-to-body><div v-if="previewRow" class="preview-body"><img class="preview-qr" :src="svgLink" :alt="t('previewDialogTitle')"/><div class="preview-code">{{previewRow.short_code}}</div><label class="preview-label">{{t('originalShortLink')}}</label><el-input :model-value="shortLink" readonly class="preview-link"></el-input><div class="preview-actions"><el-button type="primary" @click="copyAndOpenShortLink">{{t('copyAndOpen')}} ↗</el-button><el-button @click="previewVisible=false">{{t('closeDialog')}}</el-button></div><p class="small">{{t('previewNotice')}}</p></div></el-dialog>
 </el-config-provider>
</template>
