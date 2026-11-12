(() => {
  const cfg = window.SHOP_CONFIG || {};
  const client = window.supabase?.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  const PAGE = Number(cfg.pageSize) > 0 ? Number(cfg.pageSize) : 24;
  const money = value => `${new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(Number(value)||0)} ر.س`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);
  const state = { products:[], offset:0, hasMore:true, busy:false, term:'', category:'', categories:[], cart:readCart(), toastTimer:null };
  let checkoutChannel='site';
  const productName = p => p.type || (p.product_code ? `صنف ${p.product_code}` : 'منتج إكسسوارات');
  const label = p => [p.model,p.color].filter(Boolean).join(' · ') || productName(p);
  const imageUrl = raw => {
    if (!raw) return '';
    const s = String(raw).trim();
    if (/^https?:\/\//i.test(s) || s.startsWith('data:image/')) return s;
    const m = s.match(/(?:storage\/v1\/object\/public\/)([^/]+)\/(.+)$/);
    const bucket = m?.[1] || cfg.storageBucket;
    const path = m?.[2] || s.replace(/^\/+/, '');
    return bucket && client ? client.storage.from(bucket).getPublicUrl(path).data.publicUrl : '';
  };
  function readCart(){ try { const v=JSON.parse(localStorage.getItem('store-cart-v2')||'[]'); return Array.isArray(v)?v.filter(x=>x&&x.id&&Number(x.qty)>0):[]; } catch { return []; } }
  function saveCart(){ localStorage.setItem('store-cart-v2',JSON.stringify(state.cart)); renderCart(); }
  function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove('show'),2400);}
  function setNotice(message=''){const n=$('notice');n.textContent=message;n.hidden=!message;}
  function showLoading(on){$('loading').hidden=!on;state.busy=on;}
  const groupKey=p=>p.product_code?`${String(p.product_code).trim()}\u0000${String(p.company||'').trim().toLocaleLowerCase()}`:`id:${p.id}`;
  function groupProducts(rows){const map=new Map();for(const p of rows){const key=groupKey(p);if(!map.has(key))map.set(key,{key,code:p.product_code||'',company:p.company||'',category:p.category||'',products:[]});const g=map.get(key);if(!g.products.some(x=>String(x.id)===String(p.id)))g.products.push(p);}return [...map.values()];}
  function detailUrl(p){const u=new URL('product.html',location.href);u.searchParams.set('id',p.id);if(p.product_code)u.searchParams.set('code',p.product_code);if(p.company)u.searchParams.set('company',p.company);return u.href;}
  function renderProducts(){
    const grid=$('product-grid');grid.replaceChildren();const groups=groupProducts(state.products);
    if($('sort').value==='price-low')groups.sort((a,b)=>Math.min(...a.products.map(x=>Number(x.price)||0))-Math.min(...b.products.map(x=>Number(x.price)||0)));
    if($('sort').value==='price-high')groups.sort((a,b)=>Math.max(...b.products.map(x=>Number(x.price)||0))-Math.max(...a.products.map(x=>Number(x.price)||0)));
    for(const g of groups){const p=g.products[0],pic=imageUrl(p.image),prices=g.products.map(x=>Number(x.price)).filter(Number.isFinite),low=Math.min(...prices),high=Math.max(...prices),priceLabel=g.products.every(x=>x.price!==null&&Number(x.price)>0)?(low===high?money(low):`${money(low)} – ${money(high)}`):'السعر عند الطلب',modelCount=(p.models||[]).length,colorCount=(p.colors||[]).length;const optionLabel=modelCount?`${modelCount} موديل`:colorCount?`${colorCount} لون`:'خيار واحد';const card=document.createElement('a');card.className='product-card grouped-card';card.href=detailUrl(p);card.setAttribute('aria-label',`عرض خيارات ${productName(p)}`);card.innerHTML=`<div class="product-image">${pic?`<img loading="lazy" src="${esc(pic)}" alt="${esc(productName(p))}" />`:`<span class="image-placeholder" aria-label="لا توجد صورة">▧</span>`}${g.category?`<span class="product-category">${esc(g.category)}</span>`:''}<span class="model-count">${esc(optionLabel)}</span></div><div class="product-content"><h3 class="product-title">${esc(productName(p))}</h3><div class="product-meta">${g.code?`<span class="product-code">كود المنتج: ${esc(g.code)}</span>`:''}${g.company?`<span>الماركة: ${esc(g.company)}</span>`:''}${colorCount?`<span>${colorCount} ألوان</span>`:''}</div><div class="product-bottom"><span class="price">${priceLabel}${priceLabel==='السعر عند الطلب'?'':'<small>/ للوحدة</small>'}</span><span class="view-models">عرض الخيارات <b>←</b></span></div></div>`;card.querySelector('img')?.addEventListener('error',e=>e.currentTarget.replaceWith(Object.assign(document.createElement('span'),{className:'image-placeholder',textContent:'▧'})),{once:true});grid.append(card);}
    $('result-count').textContent=groups.length?`عرض ${new Intl.NumberFormat('ar-SA').format(groups.length)} مجموعة`:'';$('empty').hidden=groups.length!==0||state.busy;$('load-more').hidden=!state.hasMore||groups.length===0;
  }
  function addToCart(p,qty=1){const found=state.cart.find(x=>String(x.id)===String(p.id)&&(x.model||'')===(p.model||'')&&(x.color||'')===(p.color||''));if(found)found.qty+=qty;else state.cart.push({id:p.id,qty,model:p.model||'',color:p.color||'',name:productName(p),title:`${productName(p)}${p.model?` · ${p.model}`:''}${p.color?` · ${p.color}`:''}`,code:p.product_code||'',company:p.company||'',price:Number(p.price)>0?Number(p.price):null,image:p.image||''});saveCart();toast('تمت إضافة المنتج إلى السلة');}
  function cartCount(){return state.cart.reduce((n,x)=>n+Number(x.qty),0)}
  function cartGroupKey(item){const name=item.name||(item.title||'').split(' · ')[0];const identity=item.code?`${String(item.code).trim()}\u0000${String(item.company||'').trim().toLocaleLowerCase()}\u0000${name}`:`id:${item.id}\u0000${name}`;return `${identity}\u0000${item.model||''}`;}
  function renderCart(){
    $('cart-count').textContent=cartCount();$('drawer-count').textContent=`(${cartCount()})`;$('cart-items').replaceChildren();$('cart-empty').hidden=state.cart.length>0;$('cart-footer').hidden=state.cart.length===0;
    const groups=new Map();for(const item of state.cart){const key=cartGroupKey(item);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}let total=0,hasUnpriced=false;
    for(const items of groups.values()){
      const first=items[0],pic=imageUrl(first.image),groupUnpriced=items.some(x=>!(Number(x.price)>0)),groupTotal=items.reduce((sum,x)=>sum+(Number(x.price)>0?Number(x.price):0)*Number(x.qty||0),0);if(groupUnpriced)hasUnpriced=true;else total+=groupTotal;
      const name=first.name||(first.title||'').split(' · ')[0],title=`${name}${first.model?` · ${first.model}`:''}`,line=document.createElement('div');line.className='cart-row';
      line.innerHTML=`${pic?`<img class="cart-thumb" src="${esc(pic)}" alt="" />`:'<span class="cart-thumb image-placeholder">▧</span>'}<div class="cart-info"><strong>${esc(title)}</strong><small>${first.code?`الكود: ${esc(first.code)} · `:''}${items.length===1?(Number(first.price)>0?`${money(first.price)} للوحدة`:'بانتظار التسعير'):''}</small><div class="cart-variant-list">${items.map((item,i)=>`<div class="cart-variant-chip"><span>${esc(item.color||'بدون لون')} × ${new Intl.NumberFormat('ar-SA').format(item.qty)}<small>${Number(item.price)>0?`${money(item.price)} / وحدة`:'بانتظار التسعير'}</small></span><div><button type="button" data-variant="${i}" data-action="minus" aria-label="تقليل ${esc(item.color||'الكمية')}">−</button><button type="button" data-variant="${i}" data-action="plus" aria-label="زيادة ${esc(item.color||'الكمية')}">+</button><button type="button" data-variant="${i}" data-action="remove" aria-label="حذف ${esc(item.color||'الصنف')}">×</button></div></div>`).join('')}</div></div><span class="cart-line-price">${groupUnpriced?'بانتظار التسعير':money(groupTotal)}</span>`;
      line.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>{const item=items[Number(btn.dataset.variant)],action=btn.dataset.action;if(action==='plus')item.qty++;if(action==='minus')item.qty=Math.max(1,item.qty-1);if(action==='remove')state.cart=state.cart.filter(x=>x!==item);saveCart();}));
      const img=line.querySelector('img');if(img)img.addEventListener('error',()=>img.replaceWith(Object.assign(document.createElement('span'),{className:'cart-thumb image-placeholder',textContent:'▧'})),{once:true});$('cart-items').append(line);
    }
    $('cart-total').textContent=hasUnpriced?'الإجمالي النهائي بعد التسعير':money(total);
  }
  function openCart(){ $('drawer-backdrop').hidden=false;$('cart-drawer').classList.add('open');$('cart-drawer').setAttribute('aria-hidden','false');document.body.style.overflow='hidden'; }
  function closeCart(){ $('cart-drawer').classList.remove('open');$('cart-drawer').setAttribute('aria-hidden','true');$('drawer-backdrop').hidden=true;document.body.style.overflow=''; }
  function makeQuery(){
    let q=client.from('store_products').select('id,category,type,company,product_code,price,quantity,image,models,colors,created_at').eq('is_active',true).order('created_at',{ascending:false}).range(state.offset,state.offset+PAGE-1);
    if(state.category) q=q.eq('category',state.category);
    if(state.term){const t=state.term.replace(/[,%()]/g,' ').trim();if(t)q=q.or(['product_code','category','company','type'].map(c=>`${c}.ilike.%${t}%`).join(','));}
    if($('sort').value==='price-low')q=q.order('price',{ascending:true,nullsFirst:false});if($('sort').value==='price-high')q=q.order('price',{ascending:false,nullsFirst:false});
    return q;
  }
  async function loadProducts(append=false){
    if(!client){setNotice('تعذّر تهيئة الاتصال. تحقق من إعدادات Supabase في config.js.');return;}
    if(state.busy)return; if(!append)state.offset=0;showLoading(true);setNotice('');
    const {data,error}=await makeQuery();showLoading(false);
    if(error){setNotice(`تعذّر تحميل المنتجات من قاعدة البيانات. ${error.message}`);if(!append)state.products=[];renderProducts(append);return;}
    const rows=data||[];state.products=append?state.products.concat(rows):rows;state.offset+=rows.length;state.hasMore=rows.length===PAGE;renderProducts(append);
  }
  async function loadCategories(){if(!client)return;const {data,error}=await client.from('store_products').select('category').eq('is_active',true).order('category');if(error)return;state.categories=[...new Set((data||[]).map(x=>x.category).filter(Boolean))];const root=$('categories');root.replaceChildren();const all=document.createElement('button');all.className='category-chip active';all.dataset.category='';all.type='button';all.textContent='الكل';root.append(all);for(const name of state.categories){const b=document.createElement('button');b.className='category-chip';b.dataset.category=name;b.type='button';b.textContent=name;root.append(b);}root.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.category;root.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));loadProducts();}));}
  function sendWhatsAppOrder(event){
    event.preventDefault();const form=event.currentTarget,error=$('checkout-error');error.hidden=true;if(!state.cart.length){error.textContent='السلة فارغة. أضف منتجًا واحدًا على الأقل.';error.hidden=false;return;}if(!form.reportValidity())return;
    let number=String(cfg.contactPhone||'').replace(/\D/g,'');if(number.startsWith('00'))number=number.slice(2);if(number.startsWith('0'))number=number.slice(1);if(/^5\d{8}$/.test(number))number=`966${number}`;if(number.length<8){error.textContent='رقم واتساب الشركة غير مضبوط في إعدادات المتجر.';error.hidden=false;return;}
    const data=new FormData(form),unpriced=state.cart.some(x=>!(Number(x.price)>0)),items=state.cart.map(item=>{const option=[item.model,item.color].filter(Boolean).join('، '),price=Number(item.price)>0?`${money(item.price)} للوحدة`:'بانتظار تأكيد السعر';return `• ${item.name||item.title}${item.code?` (كود ${item.code})`:''}${option?` — ${option}`:''} × ${new Intl.NumberFormat('ar-SA').format(item.qty)} — ${price}`;});
    const message=[`طلب جملة جديد — ${cfg.companyName||'Wesam Smart'}`,`اسم المحل: ${String(data.get('shopName')).trim()}`,`رقم الجوال: ${String(data.get('phone')).trim()}`,`موقع المحل: ${String(data.get('location')).trim()}`,'','الأصناف:',...items,'',`الإجمالي: ${unpriced?'تقديري، يوجد صنف بانتظار تأكيد السعر':money(state.cart.reduce((sum,x)=>sum+Number(x.price)*Number(x.qty),0))}`,'الأسعار استرشادية وقابلة للتفاوض مع المندوب. لا يوجد دفع إلكتروني.',String(data.get('notes')||'').trim()?`ملاحظات: ${String(data.get('notes')).trim()}`:''].filter(Boolean).join('\n');
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');$('checkout-dialog').close();closeCart();toast('فتحنا واتساب برسالة الطلب؛ راجعها واضغط إرسال. بقيت السلة محفوظة.');
  }
  async function submitOrder(event){
    event.preventDefault();const form=event.currentTarget,submit=$('submit-order'),error=$('checkout-error');error.hidden=true;
    if(!state.cart.length){error.textContent='السلة فارغة. أضف منتجًا واحدًا على الأقل.';error.hidden=false;return;}
    if(!form.reportValidity())return;
    if(!client){error.textContent='تعذّر الاتصال. لم يتم إرسال الطلب، وسلتك محفوظة.';error.hidden=false;return;}
    submit.disabled=true;submit.textContent='جارٍ إرسال الطلب...';
    const data=new FormData(form),key=localStorage.getItem('store-order-key')||crypto.randomUUID();localStorage.setItem('store-order-key',key);
    const payload={p_customer_name:String(data.get('shopName')).trim(),p_customer_phone:String(data.get('phone')).trim(),p_customer_location:String(data.get('location')).trim(),p_notes:String(data.get('notes')||'').trim()||null,p_items:state.cart.map(x=>({product_id:x.id,model:x.model||null,color:x.color||null,quantity:Number(x.qty)})),p_request_key:key};
    const {data:result,error:rpcError}=await client.rpc('submit_store_order',payload);
    submit.disabled=false;submit.innerHTML='إرسال الطلب <span>←</span>';
    if(rpcError){error.textContent=rpcError.message.includes('Could not find the function')?'خدمة إرسال الطلب لم تُفعّل بعد. اطلب من مسؤول قاعدة البيانات تطبيق ملف sql/wholesale-orders.sql.':`تعذّر حفظ الطلب: ${rpcError.message}`;error.hidden=false;return;}
    const orderId=typeof result==='object'?(result.order_number??result.order_id??result.id??result):result;
    state.cart=[];localStorage.removeItem('store-cart-v2');localStorage.removeItem('store-order-key');saveCart();form.reset();$('checkout-dialog').close();closeCart();$('success-order-number').textContent=`${orderId}`;$('success-dialog').showModal();
  }
  function init(){
    $('year').textContent=new Date().getFullYear();$('company-name').textContent=cfg.companyName||'Wesam Smart';$('footer-company').textContent=cfg.companyName||'Wesam Smart';
    const instructions=$('order-instructions'),rememberInstructions=()=>{if($('hide-order-instructions').checked)localStorage.setItem('store-order-instructions-hidden','1');};$('show-order-instructions').addEventListener('click',()=>instructions.showModal());$('close-order-instructions').addEventListener('click',()=>{rememberInstructions();instructions.close();});instructions.addEventListener('close',rememberInstructions);if(!localStorage.getItem('store-order-instructions-hidden')&&!sessionStorage.getItem('store-order-instructions-shown')){sessionStorage.setItem('store-order-instructions-shown','1');instructions.showModal();}
    if(cfg.contactPhone){$('contact-link').href=`tel:${cfg.contactPhone}`;$('contact-button').href=`tel:${cfg.contactPhone}`;}else{$('contact-link').hidden=true;$('contact-button').hidden=true;}
    $('open-cart').addEventListener('click',openCart);$('close-cart').addEventListener('click',closeCart);$('drawer-backdrop').addEventListener('click',closeCart);$('browse-products').addEventListener('click',()=>{closeCart();$('catalog').scrollIntoView({behavior:'smooth'});});
    $('checkout-button').addEventListener('click',()=>{checkoutChannel='site';$('submit-order').innerHTML='إرسال الطلب <span>←</span>';$('checkout-dialog').querySelector('.dialog-head p').textContent='أدخل معلوماتك ليتواصل معك فريقنا لتأكيد الطلب.';closeCart();$('checkout-dialog').showModal();});$('whatsapp-order-button').addEventListener('click',()=>{checkoutChannel='whatsapp';$('submit-order').innerHTML='متابعة إلى واتساب <span>←</span>';$('checkout-dialog').querySelector('.dialog-head p').textContent='أدخل بيانات المحل، وسنفتح واتساب برسالة جاهزة بتفاصيل الطلب.';closeCart();$('checkout-dialog').showModal();});$('close-checkout').addEventListener('click',()=>$('checkout-dialog').close());$('checkout-form').addEventListener('submit',event=>checkoutChannel==='whatsapp'?sendWhatsAppOrder(event):submitOrder(event));$('success-done').addEventListener('click',()=>$('success-dialog').close());
    let timer; $('search').addEventListener('input',e=>{clearTimeout(timer);state.term=e.target.value.trim();timer=setTimeout(()=>loadProducts(),230);});$('sort').addEventListener('change',()=>loadProducts());$('load-more').addEventListener('click',()=>loadProducts(true));
    renderCart();if(!client){setNotice('أضف إعدادات Supabase صالحة في config.js لعرض المنتجات.');return;}loadCategories();loadProducts();if(new URLSearchParams(location.search).get('cart')==='1')openCart();
  }
  init();
})();
