'use strict';
// Chỉ xử lý góp ý; không truy cập Engine hoặc trạng thái phím.
(() => {
  const form = document.getElementById('feedback-form');
  if (!form) return;
  const input = document.getElementById('feedback-image');
  const drop = document.getElementById('feedback-upload');
  const preview = document.getElementById('feedback-preview');
  const previewImage = document.getElementById('feedback-preview-image');
  const filename = document.getElementById('feedback-filename');
  const status = document.getElementById('feedback-status');
  const submit = document.getElementById('feedback-submit');
  const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const maxImageBytes = 5 * 1024 * 1024;
  let previewUrl = null;
  let submitting = false;
  const message = (text, error = false) => {
    status.textContent = text;
    status.dataset.error = String(error);
  };
  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    previewImage.removeAttribute('src');
    filename.textContent = '';
    preview.hidden = true;
  };
  const validateImage = file => !file || (imageTypes.has(file.type) && file.size <= maxImageBytes);
  const updateImage = () => {
    clearPreview();
    const file = input.files[0];
    if (!validateImage(file)) {
      input.value = '';
      message('Ảnh cần là PNG, JPG hoặc WEBP, dung lượng tối đa 5 MB.', true);
      return false;
    }
    if (file) {
      previewUrl = URL.createObjectURL(file);
      previewImage.src = previewUrl;
      filename.textContent = file.name;
      preview.hidden = false;
    }
    message('');
    return true;
  };
  const attachImage = file => {
    if (!validateImage(file)) {
      message('Ảnh cần là PNG, JPG hoặc WEBP, dung lượng tối đa 5 MB.', true);
      return;
    }
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    updateImage();
  };
  input.addEventListener('change', updateImage);
  document.getElementById('feedback-remove').addEventListener('click', () => {
    input.value = '';
    clearPreview();
    message('');
  });
  drop.addEventListener('dragover', event => {
    event.preventDefault();
    drop.dataset.dragging = 'true';
  });
  drop.addEventListener('dragleave', () => { drop.dataset.dragging = 'false'; });
  drop.addEventListener('drop', event => {
    event.preventDefault();
    drop.dataset.dragging = 'false';
    const file = event.dataTransfer.files[0];
    if (file) attachImage(file);
  });
  form.addEventListener('paste', event => {
    const item = Array.from(event.clipboardData?.items || []).find(item => item.kind === 'file');
    const file = item?.getAsFile();
    if (file) { event.preventDefault(); attachImage(file); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    if (!validateImage(input.files[0])) {
      message('Ảnh cần là PNG, JPG hoặc WEBP, dung lượng tối đa 5 MB.', true);
      return;
    }
    if (!navigator.onLine) {
      message('Cần kết nối mạng để gửi góp ý. Nội dung vẫn được giữ trong cửa sổ này; máy tính vẫn dùng được ngoại tuyến.', true);
      return;
    }
    if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && form.dataset.desktopFeedback !== 'true') {
      message('Bản xem trước này chưa kết nối nơi nhận góp ý. Vui lòng gửi từ đường dẫn thử nghiệm được chia sẻ.', true);
      return;
    }
    document.getElementById('feedback-display').value = document.getElementById('screen')?.textContent || '';
    submitting = true;
    submit.disabled = true;
    submit.textContent = 'Đang gửi…';
    message('Đang gửi góp ý và ảnh đính kèm…');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
      const response = await fetch(form.action, { method: 'POST', body: new FormData(form), signal: controller.signal });
      if (!response.ok) throw new Error('Submission failed');
      form.reset();
      clearPreview();
      message('Đã gửi góp ý. Cảm ơn bạn đã giúp hoàn thiện bản giả lập!');
    } catch (error) {
      message('Chưa gửi được góp ý. Nội dung vẫn được giữ lại; bạn vui lòng thử lại khi kết nối ổn định.', true);
    } finally {
      clearTimeout(timeout);
      submitting = false;
      submit.disabled = false;
      submit.textContent = 'Gửi góp ý';
    }
  });
})();
