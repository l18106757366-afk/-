'use strict';

var STORAGE_KEY = 'xiaozhangben_v1';
var HINT_KEY = 'xzb_hint_dismissed';

var EXPENSE_CATS = [
  { id: 'food', name: '餐饮', icon: '🍜', color: '#FF9500' },
  { id: 'transport', name: '交通', icon: '🚌', color: '#007AFF' },
  { id: 'shopping', name: '购物', icon: '🛍️', color: '#FF2D55' },
  { id: 'housing', name: '居住', icon: '🏠', color: '#5856D6' },
  { id: 'entertain', name: '娱乐', icon: '🎮', color: '#AF52DE' },
  { id: 'medical', name: '医疗', icon: '💊', color: '#34C759' },
  { id: 'study', name: '学习', icon: '📚', color: '#00C7BE' },
  { id: 'social', name: '人情', icon: '🧧', color: '#FF3B30' },
  { id: 'other', name: '其他', icon: '📦', color: '#8E8E93' }
];

var INCOME_CATS = [
  { id: 'salary', name: '工资', icon: '💼', color: '#34C759' },
  { id: 'bonus', name: '奖金', icon: '🎁', color: '#FF9500' },
  { id: 'invest', name: '理财', icon: '📈', color: '#007AFF' },
  { id: 'redpacket', name: '红包', icon: '🧧', color: '#FF2D55' },
  { id: 'other_income', name: '其他', icon: '💰', color: '#8E8E93' }
];

var records = [];
var viewDate = new Date();
var activeTab = 'home';
var statsType = 'expense';
var addState = null;
var editingId = null;
var lastDonut = { segs: [], total: 0, label: '' };

function $(id) { return document.getElementById(id); }

var sheet = $('sheet');
var backdrop = $('backdrop');
var recordList = $('recordList');
var catGrid = $('catGrid');
var keypad = $('keypad');
var amountRow = $('amountRow');
var amountText = $('amountText');
var noteWrap = $('noteWrap');
var noteInput = $('noteInput');
var dateInput = $('dateInput');
var dateKeyBtn = $('dateKeyBtn');
var sheetDelete = $('sheetDelete');
var topbarTitle = $('topbarTitle');
var prevMonthBtn = $('prevMonth');
var nextMonthBtn = $('nextMonth');
var statsList = $('statsList');
var installHint = $('installHint');

function getCats(type) { return type === 'income' ? INCOME_CATS : EXPENSE_CATS; }

function catById(type, id) {
  var cats = getCats(type);
  for (var i = 0; i < cats.length; i++) {
    if (cats[i].id === id) return cats[i];
  }
  return { id: id, name: '其他', icon: '📦', color: '#8E8E93' };
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function pad2(n) { return n < 10 ? '0' + n : String(n); }

function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function yesterdayStr() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function monthKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }

function fmtMoney(n) {
  return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function hexToRgba(hex, a) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var num = parseInt(h, 16);
  return 'rgba(' + ((num >> 16) & 255) + ',' + ((num >> 8) & 255) + ',' + (num & 255) + ',' + a + ')';
}

function darkMode() { return window.matchMedia('(prefers-color-scheme: dark)').matches; }

function isValidRecord(r) {
  return r && typeof r === 'object' &&
    typeof r.amount === 'number' && isFinite(r.amount) && r.amount > 0 &&
    (r.type === 'expense' || r.type === 'income') &&
    typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date);
}

function normalizeRecord(r) {
  return {
    id: typeof r.id === 'string' && r.id ? r.id : genId(),
    type: r.type,
    amount: Math.round(r.amount * 100) / 100,
    category: typeof r.category === 'string' ? r.category : 'other',
    note: typeof r.note === 'string' ? r.note.slice(0, 50) : '',
    date: r.date,
    ts: typeof r.ts === 'number' ? r.ts : (Date.parse(r.date) || 0)
  };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: records }));
  } catch (e) {
    alert('保存失败:浏览器存储空间不足');
  }
}

function load() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    if (data && Array.isArray(data.records)) {
      records = [];
      data.records.forEach(function (r) {
        if (isValidRecord(r)) records.push(normalizeRecord(r));
      });
    }
  } catch (e) {}
}

function dateLabel(ds) {
  var parts = ds.split('-').map(Number);
  var dt = new Date(parts[0], parts[1] - 1, parts[2]);
  var wd = '日一二三四五六'[dt.getDay()];
  var label = parts[1] + '月' + parts[2] + '日 周' + wd;
  if (ds === todayStr()) label = '今天 · ' + label;
  else if (ds === yesterdayStr()) label = '昨天 · ' + label;
  return label;
}

function labelForDate(ds) {
  if (ds === todayStr()) return '今天';
  if (ds === yesterdayStr()) return '昨天';
  var parts = ds.split('-').map(Number);
  return parts[1] + '月' + parts[2] + '日';
}

function updateTopbar() {
  if (activeTab === 'settings') {
    topbarTitle.textContent = '设置';
    prevMonthBtn.classList.add('invisible');
    nextMonthBtn.classList.add('invisible');
  } else {
    topbarTitle.textContent = viewDate.getFullYear() + '年' + (viewDate.getMonth() + 1) + '月';
    prevMonthBtn.classList.remove('invisible');
    nextMonthBtn.classList.remove('invisible');
  }
}

function render() {
  document.querySelectorAll('.view').forEach(function (v) { v.classList.add('hidden'); });
  $('view-' + activeTab).classList.remove('hidden');
  document.querySelectorAll('.tab[data-tab]').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tab === activeTab);
  });
  updateTopbar();
  if (activeTab === 'home') renderHome();
  else if (activeTab === 'stats') renderStats();
  else renderSettings();
}

function renderHome() {
  var mk = monthKey(viewDate);
  var recs = records.filter(function (r) { return r.date.slice(0, 7) === mk; });
  var exp = 0, inc = 0;
  recs.forEach(function (r) { if (r.type === 'expense') exp += r.amount; else inc += r.amount; });

  $('monthExpense').textContent = '¥' + fmtMoney(exp);
  $('monthIncome').textContent = '¥' + fmtMoney(inc);
  $('monthBalance').textContent = '¥' + fmtMoney(inc - exp);

  if (!recs.length) {
    recordList.innerHTML = '<div class="empty"><div class="big">📒</div><div class="empty-title">本月还没有记录</div><div class="empty-sub">点击下方 + 记一笔</div></div>';
    return;
  }

  var groups = {};
  recs.forEach(function (r) {
    if (!groups[r.date]) groups[r.date] = [];
    groups[r.date].push(r);
  });

  var dates = Object.keys(groups).sort().reverse();
  recordList.innerHTML = dates.map(function (d) {
    var dayRecs = groups[d].slice().sort(function (a, b) { return b.ts - a.ts; });
    var de = 0, di = 0;
    dayRecs.forEach(function (r) { if (r.type === 'expense') de += r.amount; else di += r.amount; });
    var totals = [];
    if (de > 0) totals.push('支出 ¥' + fmtMoney(de));
    if (di > 0) totals.push('收入 ¥' + fmtMoney(di));

    var rows = dayRecs.map(function (r) {
      var c = catById(r.type, r.category);
      return '<div class="record" data-id="' + r.id + '">' +
        '<div class="rec-icon" style="background:' + hexToRgba(c.color, 0.15) + '">' + c.icon + '</div>' +
        '<div class="rec-info"><div class="rec-cat">' + c.name + '</div>' +
        (r.note ? '<div class="rec-note">' + esc(r.note) + '</div>' : '') +
        '</div>' +
        '<div class="rec-amt ' + (r.type === 'expense' ? 'neg' : 'pos') + '">' +
        (r.type === 'expense' ? '-' : '+') + fmtMoney(r.amount) + '</div>' +
        '</div>';
    }).join('');

    return '<div class="day-group">' +
      '<div class="day-header"><span>' + dateLabel(d) + '</span><span>' + totals.join('　') + '</span></div>' +
      '<div class="card">' + rows + '</div>' +
      '</div>';
  }).join('');
}

function renderStats() {
  document.querySelectorAll('#statsSeg .seg-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.type === statsType);
  });

  var mk = monthKey(viewDate);
  var recs = records.filter(function (r) { return r.type === statsType && r.date.slice(0, 7) === mk; });
  var total = 0;
  recs.forEach(function (r) { total += r.amount; });

  $('statsTotal').textContent = '¥' + fmtMoney(total);
  $('statsSub').textContent = '共 ' + recs.length + ' 笔 · ' + viewDate.getFullYear() + '年' + (viewDate.getMonth() + 1) + '月';

  var sums = {};
  recs.forEach(function (r) { sums[r.category] = (sums[r.category] || 0) + r.amount; });

  var segs = getCats(statsType).map(function (c) {
    return { id: c.id, name: c.name, icon: c.icon, color: c.color, value: sums[c.id] || 0 };
  }).filter(function (s) { return s.value > 0; }).sort(function (a, b) { return b.value - a.value; });

  if (!segs.length) {
    statsList.innerHTML = '<div class="empty small"><div class="big">📊</div><div>本月暂无' + (statsType === 'expense' ? '支出' : '收入') + '记录</div></div>';
  } else {
    statsList.innerHTML = '<div class="card stat-card">' + segs.map(function (s) {
      var pct = total > 0 ? s.value / total * 100 : 0;
      return '<div class="stat-row">' +
        '<div class="rec-icon" style="background:' + hexToRgba(s.color, 0.15) + '">' + s.icon + '</div>' +
        '<div class="stat-mid">' +
        '<div class="stat-top"><span>' + s.name + '</span><span class="stat-amt">¥' + fmtMoney(s.value) + '</span></div>' +
        '<div class="stat-bar"><div class="stat-fill" style="width:' + Math.max(pct, 2) + '%;background:' + s.color + '"></div></div>' +
        '</div>' +
        '<div class="stat-pct">' + pct.toFixed(1) + '%</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  var label = statsType === 'expense' ? '总支出' : '总收入';
  lastDonut = { segs: segs, total: total, label: label };
  drawDonut(segs, total, label);
}

function drawDonut(segs, total, label) {
  var canvas = $('donut');
  var size = canvas.clientWidth || 200;
  var dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  var ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  var cx = size / 2, cy = size / 2, r = size / 2 - 16, lw = 20;
  ctx.lineWidth = lw;

  if (!segs.length || total <= 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = darkMode() ? 'rgba(120,120,128,0.25)' : 'rgba(120,120,128,0.18)';
    ctx.stroke();
  } else {
    var gap = segs.length > 1 ? 0.035 : 0;
    var start = -Math.PI / 2;
    segs.forEach(function (s) {
      var ang = s.value / total * Math.PI * 2;
      var a0 = start + gap / 2;
      var a1 = start + ang - gap / 2;
      if (a1 - a0 > 0.01) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, a1);
        ctx.strokeStyle = s.color;
        ctx.stroke();
      }
      start += ang;
    });
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = darkMode() ? '#98989F' : '#8E8E93';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(label, cx, cy - 8);

  var amountStr = '¥' + fmtMoney(total);
  var fs = amountStr.length > 10 ? 15 : (amountStr.length > 8 ? 17 : 20);
  ctx.fillStyle = darkMode() ? '#FFFFFF' : '#1C1C1E';
  ctx.font = '600 ' + fs + 'px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(amountStr, cx, cy + 18);
}

function renderSettings() {
  $('dataCount').textContent = records.length + ' 笔';
}

function renderCatGrid() {
  var cats = getCats(addState.type);
  var found = false;
  cats.forEach(function (c) { if (c.id === addState.category) found = true; });
  if (!found) addState.category = cats[0].id;

  catGrid.innerHTML = cats.map(function (c) {
    return '<button class="cat-btn' + (c.id === addState.category ? ' selected' : '') + '" data-cat="' + c.id + '">' +
      '<span class="cat-emoji">' + c.icon + '</span>' +
      '<span class="cat-name">' + c.name + '</span>' +
      '</button>';
  }).join('');
}

function updateAmountDisplay() {
  amountText.textContent = addState.amount === '' ? '0.00' : addState.amount;
}

function setTypeButtons() {
  document.querySelectorAll('#typeSeg .seg-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.type === addState.type);
  });
}

function openAdd(rec) {
  editingId = rec ? rec.id : null;
  if (rec) {
    addState = {
      type: rec.type,
      amount: String(rec.amount),
      category: rec.category,
      date: rec.date,
      note: rec.note || ''
    };
  } else {
    addState = { type: 'expense', amount: '', category: null, date: todayStr(), note: '' };
  }

  setTypeButtons();
  sheetDelete.classList.toggle('hidden', !rec);
  noteInput.value = addState.note;
  noteWrap.classList.add('hidden');
  dateKeyBtn.textContent = labelForDate(addState.date);
  amountRow.classList.remove('shake');
  renderCatGrid();
  updateAmountDisplay();

  backdrop.classList.add('open');
  sheet.classList.add('open');
  document.body.classList.add('sheet-open');
}

function closeAdd() {
  backdrop.classList.remove('open');
  sheet.classList.remove('open');
  document.body.classList.remove('sheet-open');
  editingId = null;
  noteInput.blur();
}

function pushKey(k) {
  if (!addState) return;
  if (k === 'back') {
    addState.amount = addState.amount.slice(0, -1);
  } else if (k === 'dot') {
    if (addState.amount.indexOf('.') === -1) {
      addState.amount = (addState.amount || '0') + '.';
    }
  } else {
    var parts = addState.amount.split('.');
    if (parts[1] !== undefined && parts[1].length >= 2) return;
    if (parts[1] === undefined && parts[0].length >= 7) return;
    if (addState.amount === '0') addState.amount = k;
    else addState.amount += k;
  }
  updateAmountDisplay();
}

function saveRecord() {
  var amount = Math.round(parseFloat(addState.amount || '0') * 100) / 100;
  if (!isFinite(amount) || amount <= 0) {
    amountRow.classList.remove('shake');
    void amountRow.offsetWidth;
    amountRow.classList.add('shake');
    return;
  }

  var cats = getCats(addState.type);
  var validCat = false;
  cats.forEach(function (c) { if (c.id === addState.category) validCat = true; });
  if (!validCat) addState.category = cats[0].id;

  var note = noteInput.value.trim().slice(0, 50);
  var savedDate = addState.date;

  if (editingId) {
    records.forEach(function (r) {
      if (r.id === editingId) {
        r.type = addState.type;
        r.amount = amount;
        r.category = addState.category;
        r.note = note;
        r.date = savedDate;
      }
    });
  } else {
    records.push({
      id: genId(),
      type: addState.type,
      amount: amount,
      category: addState.category,
      note: note,
      date: savedDate,
      ts: Date.now()
    });
  }

  save();
  closeAdd();

  var parts = savedDate.split('-').map(Number);
  viewDate = new Date(parts[0], parts[1] - 1, 1);
  render();
}

function deleteEditing() {
  if (!editingId) return;
  if (!confirm('删除这条记录?')) return;
  var id = editingId;
  records = records.filter(function (r) { return r.id !== id; });
  save();
  closeAdd();
  render();
}

function exportData() {
  var data = {
    app: 'xiaozhangben',
    version: 1,
    exportedAt: new Date().toISOString(),
    records: records
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'xiaozhangben-backup-' + todayStr().replace(/-/g, '') + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
}

function handleImport(file) {
  var reader = new FileReader();
  reader.onload = function () {
    var list = null;
    try {
      var data = JSON.parse(reader.result);
      if (Array.isArray(data)) list = data;
      else if (data && Array.isArray(data.records)) list = data.records;
    } catch (e) {}
    if (!list) {
      alert('导入失败:文件格式不正确');
      return;
    }
    var valid = list.filter(isValidRecord);
    if (!valid.length) {
      alert('文件中没有有效的记账记录');
      return;
    }
    if (!confirm('检测到 ' + valid.length + ' 条有效记录,是否与现有记录合并导入?')) return;
    var ids = {};
    records.forEach(function (r) { ids[r.id] = true; });
    var added = 0;
    valid.forEach(function (r) {
      if (!ids[r.id]) {
        records.push(normalizeRecord(r));
        ids[r.id] = true;
        added++;
      }
    });
    save();
    render();
    alert('成功导入 ' + added + ' 条记录');
  };
  reader.readAsText(file);
}

function clearAll() {
  if (!records.length) {
    alert('当前没有可清空的数据');
    return;
  }
  if (!confirm('确定要清空所有记账数据吗?')) return;
  if (!confirm('再次确认:所有记录将被永久删除,且无法恢复!')) return;
  records = [];
  save();
  render();
  alert('已清空所有数据');
}

function switchTab(tab) {
  activeTab = tab;
  render();
}

document.querySelectorAll('.tab[data-tab]').forEach(function (b) {
  b.addEventListener('click', function () { switchTab(b.dataset.tab); });
});

$('addBtn').addEventListener('click', function () { openAdd(null); });
$('sheetCancel').addEventListener('click', closeAdd);
backdrop.addEventListener('click', closeAdd);
sheetDelete.addEventListener('click', deleteEditing);

prevMonthBtn.addEventListener('click', function () {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  render();
});

nextMonthBtn.addEventListener('click', function () {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  render();
});

document.querySelectorAll('#typeSeg .seg-btn').forEach(function (b) {
  b.addEventListener('click', function () {
    if (addState.type === b.dataset.type) return;
    addState.type = b.dataset.type;
    addState.category = null;
    setTypeButtons();
    renderCatGrid();
  });
});

document.querySelectorAll('#statsSeg .seg-btn').forEach(function (b) {
  b.addEventListener('click', function () {
    if (statsType === b.dataset.type) return;
    statsType = b.dataset.type;
    renderStats();
  });
});

catGrid.addEventListener('click', function (e) {
  var btn = e.target.closest('.cat-btn');
  if (!btn) return;
  addState.category = btn.dataset.cat;
  renderCatGrid();
});

recordList.addEventListener('click', function (e) {
  var row = e.target.closest('.record');
  if (!row) return;
  var rec = null;
  records.forEach(function (r) { if (r.id === row.dataset.id) rec = r; });
  if (rec) openAdd(rec);
});

keypad.addEventListener('click', function (e) {
  var btn = e.target.closest('button[data-key]');
  if (!btn) return;
  var k = btn.dataset.key;
  if (k === 'done') { saveRecord(); return; }
  if (k === 'date') {
    dateInput.value = addState.date;
    if (dateInput.showPicker) {
      try { dateInput.showPicker(); return; } catch (err) {}
    }
    dateInput.click();
    return;
  }
  if (k === 'note') {
    noteWrap.classList.toggle('hidden');
    if (!noteWrap.classList.contains('hidden')) {
      setTimeout(function () { noteInput.focus(); }, 50);
    }
    return;
  }
  pushKey(k);
});

dateInput.addEventListener('change', function () {
  if (dateInput.value) {
    addState.date = dateInput.value;
    dateKeyBtn.textContent = labelForDate(addState.date);
  }
});

$('exportBtn').addEventListener('click', exportData);

$('importBtn').addEventListener('click', function () {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', function () {
    if (input.files && input.files[0]) handleImport(input.files[0]);
  });
  input.click();
});

$('clearBtn').addEventListener('click', clearAll);

$('installClose').addEventListener('click', function () {
  installHint.classList.add('hidden');
  try { localStorage.setItem(HINT_KEY, '1'); } catch (e) {}
});

window.addEventListener('resize', function () {
  if (activeTab === 'stats') drawDonut(lastDonut.segs, lastDonut.total, lastDonut.label);
});

(function init() {
  load();
  render();

  var isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  var isStandalone = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  var dismissed = false;
  try { dismissed = !!localStorage.getItem(HINT_KEY); } catch (e) {}
  if (isIos && !isStandalone && !dismissed) installHint.classList.remove('hidden');

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
