(() => {
  const cfg = window.SHOP_CONFIG || {};
  const sb = window.supabase?.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  const params = new URLSearchParams(location.search);
  const productId = params.get('id');
  if (!sb || !productId) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getVisitorId = () => {
    let id = localStorage.getItem('wesam-rating-visitor');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('wesam-rating-visitor', id);
    }
    return id;
  };

  function mount() {
    const detail = document.getElementById('detail-content');
    const otherBrands = document.getElementById('other-brands');
    if (!detail || detail.hidden || !otherBrands || document.getElementById('product-rating')) return;

    const section = document.createElement('section');
    section.id = 'product-rating';
    section.className = 'product-rating';
    section.innerHTML = `<span class="eyebrow">رأيك يهمنا</span><h2>اكتب تقييمك</h2><p class="rating-summary" id="rating-summary">جارٍ تحميل التقييمات…</p><div class="rating-stars" role="group" aria-label="اختر تقييمك من نجمة إلى خمس نجوم">${[1,2,3,4,5].map(n => `<button type="button" class="rating-star" data-rating="${n}" aria-label="${n} من 5 نجوم" aria-pressed="false">★</button>`).join('')}</div><label class="rating-comment-label" for="rating-comment">تعليقك</label><textarea id="rating-comment" class="rating-comment" maxlength="500" rows="3" placeholder="اكتب رأيك عن المنتج…" required></textarea><button type="button" class="rating-submit" id="rating-submit" disabled>إرسال التقييم</button><p class="rating-message" id="rating-message" aria-live="polite"></p><div class="rating-reviews" id="rating-reviews"></div>`;
    detail.querySelector('.detail-info')?.insertBefore(section, otherBrands);

    let chosen = 0;
    const starButtons = [...section.querySelectorAll('.rating-star')];
    const summary = section.querySelector('#rating-summary');
    const message = section.querySelector('#rating-message');
    const submit = section.querySelector('#rating-submit');
    const commentInput = section.querySelector('#rating-comment');
    const reviewsRoot = section.querySelector('#rating-reviews');
    const renderReviews = reviews => {
      reviewsRoot.replaceChildren();
      if (!reviews?.length) return;
      const heading = document.createElement('h3');
      heading.textContent = 'آراء العملاء';
      reviewsRoot.append(heading);
      for (const review of reviews) {
        const card = document.createElement('article');
        card.className = 'rating-review';
        const stars = document.createElement('strong');
        stars.className = 'rating-review-stars';
        stars.textContent = `${'★'.repeat(Number(review.rating)||0)}${'☆'.repeat(5-(Number(review.rating)||0))}`;
        const date = document.createElement('time');
        date.dateTime = review.created_at;
        date.textContent = new Date(review.created_at).toLocaleDateString('ar-SA');
        const text = document.createElement('p');
        text.textContent = review.comment;
        card.append(stars, date, text);
        reviewsRoot.append(card);
      }
    };
    const loadReviews = async () => {
      const { data, error } = await sb.rpc('get_store_product_reviews', { p_product_id: productId });
      if (!error) renderReviews(data || []);
    };
    starButtons.forEach(button => button.addEventListener('click', () => {
      chosen = Number(button.dataset.rating);
      starButtons.forEach(star => {
        const active = Number(star.dataset.rating) <= chosen;
        star.classList.toggle('selected', active);
        star.setAttribute('aria-pressed', String(Number(star.dataset.rating) === chosen));
      });
      submit.disabled = false;
      message.textContent = '';
    }));

    sb.rpc('get_store_product_ratings', { p_product_ids: [productId] }).then(({ data, error }) => {
      if (error) {
        summary.textContent = 'التقييم غير متاح حاليًا.';
        return;
      }
      const result = data?.[0];
      summary.textContent = result
        ? `★ ${new Intl.NumberFormat('ar-SA').format(Number(result.average_rating))} من 5 · ${new Intl.NumberFormat('ar-SA').format(Number(result.rating_count))} تقييمات`
        : 'لا توجد تقييمات بعد — كن أول من يقيّم هذا المنتج.';
    });
    loadReviews();

    submit.addEventListener('click', async () => {
      if (!chosen || submit.disabled) return;
      if (!commentInput.value.trim()) {
        commentInput.focus();
        message.textContent = 'اكتب تعليقك قبل إرسال التقييم.';
        return;
      }
      submit.disabled = true;
      submit.textContent = 'جارٍ حفظ تقييمك…';
      message.textContent = '';
      const { data, error } = await sb.rpc('submit_store_product_rating', {
        p_product_id: productId,
        p_rating: chosen,
        p_visitor_id: getVisitorId(),
        p_comment: commentInput.value.trim()
      });
      submit.textContent = 'إرسال التقييم';
      submit.disabled = false;
      if (error) {
        message.textContent = error.message.includes('Could not find the function')
          ? 'فعّل ميزة التقييم بتشغيل sql/product-ratings.sql في Supabase.'
          : 'تعذّر حفظ التقييم. حاول مرة أخرى.';
        return;
      }
      const result = data || {};
      summary.textContent = `★ ${new Intl.NumberFormat('ar-SA').format(Number(result.average_rating))} من 5 · ${new Intl.NumberFormat('ar-SA').format(Number(result.rating_count))} تقييمات`;
      message.textContent = 'شكرًا لك، تم حفظ تقييمك.';
      loadReviews();
    });
  }

  const detail = document.getElementById('detail-content');
  if (detail && !detail.hidden) mount();
  else if (detail) new MutationObserver(mount).observe(detail, { attributes: true, attributeFilter: ['hidden'] });
})();
