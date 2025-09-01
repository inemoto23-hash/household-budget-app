// グローバル変数
// 現在のローカル時間を取得する関数（月操作を安全にするため）
function getCurrentLocalTime() {
    return new Date();
}

// 日本時間基準でYYYY-MM-DD形式の文字列を生成
function formatDateForJapan(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

let currentDate = getCurrentLocalTime();
let selectedDate = null;
let expenseCategories = [];
let walletCategories = [];
let creditCategories = [];
let lastTransaction = null;
let currentSuggestions = null;

// DOM要素
const views = {
    calendar: document.getElementById('calendar-view'),
    input: document.getElementById('input-view'),
    budget: document.getElementById('budget-view'),
    receipt: document.getElementById('receipt-view'),
    summary: document.getElementById('summary-view'),
    balance: document.getElementById('balance-view')
};

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    await loadCategories();
    setupEventListeners();
    showCalendar();
    setDefaultDate();
    populateYearMonthSelectors();
});

// カテゴリデータの読み込み
async function loadCategories() {
    try {
        const [expenseRes, walletRes, creditRes] = await Promise.all([
            fetch('/api/expense-categories'),
            fetch('/api/wallet-categories'),
            fetch('/api/credit-categories')
        ]);
        
        expenseCategories = await expenseRes.json();
        walletCategories = await walletRes.json();
        creditCategories = await creditRes.json();
        
        await populateSelects();
    } catch (error) {
        console.error('カテゴリの読み込みに失敗しました:', error);
        alert('カテゴリデータの読み込みに失敗しました');
    }
}

// セレクトボックスの選択肢を設定
async function populateSelects(targetYear = null, targetMonth = null) {
    const expenseSelect = document.getElementById('expense-category');
    const walletSelect = document.getElementById('wallet-category');
    const creditSelect = document.getElementById('credit-category');
    const receiptWalletSelect = document.getElementById('receipt-wallet-category');
    const receiptCreditSelect = document.getElementById('receipt-credit-category');
    const transferFromSelect = document.getElementById('transfer-from');
    const transferToSelect = document.getElementById('transfer-to');
    const chargeFromSourceSelect = document.getElementById('charge-from-source');
    const chargeToWalletSelect = document.getElementById('charge-to-wallet');
    const budgetFromCategorySelect = document.getElementById('budget-from-category');
    const budgetToCategorySelect = document.getElementById('budget-to-category');
    
    // 既存の選択肢をクリア
    [expenseSelect, walletSelect, creditSelect, receiptWalletSelect, receiptCreditSelect, transferFromSelect, transferToSelect, chargeFromSourceSelect, chargeToWalletSelect, budgetFromCategorySelect, budgetToCategorySelect].forEach(select => {
        if (select) select.innerHTML = '';
    });
    
    // 指定された月または現在の月の予算残高を取得
    let year, month;
    if (targetYear && targetMonth) {
        year = targetYear;
        month = targetMonth;
    } else {
        const currentDate = getCurrentLocalTime();
        year = currentDate.getFullYear();
        month = currentDate.getMonth() + 1;
    }
    
    let budgetData = {};
    try {
        console.log(`API呼び出し: /api/summary/${year}/${month}`);
        const response = await fetch(`/api/summary/${year}/${month}`);
        const summary = await response.json();
        console.log(`取得した集計データ:`, summary);
        
        // 配列をオブジェクトに変換
        if (summary.expenseSummary && Array.isArray(summary.expenseSummary)) {
            summary.expenseSummary.forEach(item => {
                budgetData[item.category] = {
                    total: item.total,
                    budget: item.budget,
                    remaining: item.remaining
                };
            });
        }
        console.log(`予算データ:`, budgetData);
    } catch (error) {
        console.error('予算残高の取得に失敗:', error);
    }
    
    // 出費カテゴリ（予算残高付き）- 保存された順序を適用
    const sortedExpenseCategories = loadItemOrder('#expense-category', expenseCategories, 'category.name');
    sortedExpenseCategories.forEach(category => {
        const budget = budgetData[category.name];
        const remaining = budget ? budget.remaining : 0;
        console.log(`${category.name}: 予算残高=${remaining}`);
        const displayName = `${category.name} (残¥${remaining.toLocaleString()})`;
        const option = new Option(displayName, category.id);
        expenseSelect.add(option);
    });
    
    // 予算振替用カテゴリ（出費カテゴリと同じ、予算残高付き）- 保存された順序を適用
    [budgetFromCategorySelect, budgetToCategorySelect].forEach(select => {
        if (select) {
            sortedExpenseCategories.forEach(category => {
                const budget = budgetData[category.name];
                const remaining = budget ? budget.remaining : 0;
                const displayName = `${category.name} (残¥${remaining.toLocaleString()})`;
                const option = new Option(displayName, category.id);
                select.add(option);
            });
        }
    });
    
    // 財布カテゴリ
    [walletSelect, receiptWalletSelect, transferFromSelect, chargeToWalletSelect].forEach(select => {
        if (select) {
            walletCategories.forEach(wallet => {
                const option = new Option(`${wallet.name} (¥${wallet.balance?.toLocaleString() || 0})`, wallet.id);
                select.add(option.cloneNode(true));
            });
        }
    });
    
    // 振替先のみ「引落」選択肢を追加
    if (transferToSelect) {
        // 引落選択肢を先に追加
        const withdrawalOption = new Option('引落', 'withdrawal');
        transferToSelect.add(withdrawalOption);
        
        walletCategories.forEach(wallet => {
            const option = new Option(`${wallet.name} (¥${wallet.balance?.toLocaleString() || 0})`, wallet.id);
            transferToSelect.add(option);
        });
    }
    
    // チャージ元にクレジットカードと財布を追加
    if (chargeFromSourceSelect) {
        // クレジットカードを追加
        creditCategories.forEach(credit => {
            const option = new Option(`🏦 ${credit.name}`, `credit_${credit.id}`);
            chargeFromSourceSelect.add(option);
        });
        
        // 財布カテゴリを追加
        walletCategories.forEach(wallet => {
            const option = new Option(`💳 ${wallet.name} (¥${wallet.balance?.toLocaleString() || 0})`, `wallet_${wallet.id}`);
            chargeFromSourceSelect.add(option);
        });
    }

    // クレジットカードカテゴリ
    [creditSelect, receiptCreditSelect].forEach(select => {
        if (select) {
            creditCategories.forEach(credit => {
                const option = new Option(credit.name, credit.id);
                select.add(option.cloneNode(true));
            });
        }
    });
}

// イベントリスナーの設定
function setupEventListeners() {
    // タブナビゲーション
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.id.replace('-tab', '');
            showView(tabId);
        });
    });
    
    // カレンダーナビゲーション
    document.getElementById('prev-month').addEventListener('click', () => {
        // 安全な月送り処理（日本時間基準）
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        currentDate = new Date(year, month - 1, 1);
        showCalendar();
    });
    
    document.getElementById('next-month').addEventListener('click', () => {
        // 安全な月送り処理（日本時間基準）
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        currentDate = new Date(year, month + 1, 1);
        showCalendar();
    });
    
    // 日付詳細ウィンドウ
    document.getElementById('close-detail').addEventListener('click', closeDayDetail);
    
    // 収支登録フォーム
    document.getElementById('transaction-form').addEventListener('submit', handleTransactionSubmit);
    document.getElementById('transaction-type').addEventListener('change', toggleExpenseCategory);
    document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
        radio.addEventListener('change', togglePaymentMethod);
    });
    document.querySelectorAll('input[name="receipt-payment-method"]').forEach(radio => {
        radio.addEventListener('change', toggleReceiptPaymentMethod);
    });
    
    // 日付変更時に予算残高を更新
    document.getElementById('transaction-date').addEventListener('change', async (e) => {
        const selectedDate = new Date(e.target.value);
        if (!isNaN(selectedDate)) {
            const year = selectedDate.getFullYear();
            const month = selectedDate.getMonth() + 1;
            console.log(`日付変更: ${year}年${month}月の予算残高を取得中...`);
            await populateSelects(year, month);
        }
    });
    
    // 1つ戻るボタン
    document.getElementById('undo-btn').addEventListener('click', undoLastTransaction);
    
    // 商品追加ボタン
    document.getElementById('add-item-btn').addEventListener('click', addItemRow);
    
    // 決済場所自動補完
    setupPaymentLocationAutocomplete();
    
    // 予算設定
    document.getElementById('load-budget').addEventListener('click', loadBudget);
    document.getElementById('save-budget').addEventListener('click', saveBudget);
    document.getElementById('copy-prev-budget').addEventListener('click', copyPreviousMonthBudget);
    
    // レシート解析
    setupReceiptUpload();
    document.getElementById('register-receipt').addEventListener('click', registerReceiptTransaction);
    
    // 集計
    document.getElementById('load-summary').addEventListener('click', loadSummary);
    
    // 予算調整
    document.getElementById('adjust-budget-btn').addEventListener('click', showBudgetAdjustmentModal);
    document.getElementById('close-adjustment-modal').addEventListener('click', closeBudgetAdjustmentModal);
    document.getElementById('cancel-adjustments').addEventListener('click', closeBudgetAdjustmentModal);
    document.getElementById('save-adjustments').addEventListener('click', saveBudgetAdjustments);
    
    // 残高管理は初期読み込み時に設定
    loadWalletBalances();
    
    // レシート詳細モーダル
    document.getElementById('close-receipt-details-modal').addEventListener('click', closeReceiptDetailsModal);
}

// ビューの切り替え
function showView(viewName) {
    // すべてのビューを非表示
    Object.values(views).forEach(view => view.classList.remove('active'));
    
    // すべてのタブボタンから active クラスを削除
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // 指定されたビューとタブボタンをアクティブに
    const targetView = views[viewName];
    const targetTab = document.getElementById(`${viewName}-tab`);
    
    if (targetView && targetTab) {
        targetView.classList.add('active');
        targetTab.classList.add('active');
        
        // ビュー固有の初期化処理
        if (viewName === 'balance') {
            loadWalletBalances();
        } else if (viewName === 'summary') {
            // 予算確認ビュー：当月のデータを自動読み込み
            const today = getCurrentLocalTime();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth() + 1;
            
            document.getElementById('summary-year').value = currentYear;
            document.getElementById('summary-month').value = currentMonth;
            loadSummary();
        } else if (viewName === 'budget') {
            // 予算設定ビュー：当月のデータを自動読み込み
            const today = getCurrentLocalTime();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth() + 1;
            
            document.getElementById('budget-year').value = currentYear;
            document.getElementById('budget-month').value = currentMonth;
            loadBudget();
        }
    }
}

// カレンダー表示
function showCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    document.getElementById('current-month').textContent = 
        `${year}年 ${month + 1}月`;
    
    const calendarGrid = document.getElementById('calendar-grid');
    calendarGrid.innerHTML = '';
    
    // 曜日ヘッダー
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    weekdays.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-header-day';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // カレンダーの日付を生成
    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const dayElement = createDayElement(date, month);
        calendarGrid.appendChild(dayElement);
    }
    
    loadMonthTransactions(year, month + 1);
}

// 日付要素の作成
function createDayElement(date, currentMonth) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    
    if (date.getMonth() !== currentMonth) {
        dayElement.classList.add('other-month');
    }
    
    const dateElement = document.createElement('div');
    dateElement.className = 'date';
    dateElement.textContent = date.getDate();
    
    const transactionCount = document.createElement('div');
    transactionCount.className = 'transaction-count';
    // 日本時間での日付文字列を生成
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    transactionCount.setAttribute('data-date', dateStr);
    
    dayElement.appendChild(dateElement);
    dayElement.appendChild(transactionCount);
    
    dayElement.addEventListener('click', () => {
        selectDate(date);
    });
    
    return dayElement;
}

// 月の取引データを読み込み
async function loadMonthTransactions(year, month) {
    try {
        // 各日付について個別に取引件数をチェック
        const transactionCounts = {};
        
        // その月の全日付をチェック
        const daysInMonth = new Date(year, month, 0).getDate();
        const promises = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            promises.push(
                fetch(`/api/transactions/date/${dateStr}`)
                    .then(response => response.json())
                    .then(transactions => {
                        transactionCounts[dateStr] = transactions.length;
                    })
                    .catch(error => {
                        console.warn(`日付 ${dateStr} の取引取得エラー:`, error);
                        transactionCounts[dateStr] = 0;
                    })
            );
        }
        
        await Promise.all(promises);
        
        // カレンダーに取引数を表示
        document.querySelectorAll('.transaction-count').forEach(element => {
            const date = element.getAttribute('data-date');
            const count = transactionCounts[date] || 0;
            element.textContent = count > 0 ? `${count}件` : '';
        });
        
        console.log('月間取引件数の読み込み完了:', transactionCounts);
    } catch (error) {
        console.error('取引データの読み込みに失敗しました:', error);
    }
}

// 日付選択
function selectDate(date) {
    selectedDate = date;
    
    // カレンダーの選択状態を更新
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
    });
    
    event.currentTarget.classList.add('selected');
    
    // 入力フォームの日付を設定（日本時間基準）
    document.getElementById('transaction-date').value = formatDateForJapan(date);
    
    // 日付詳細ウィンドウを表示
    showDayDetail(date);
}

// 日付詳細ウィンドウの表示
async function showDayDetail(date) {
    // タイムゾーンを考慮した正確な日付文字列を生成
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    document.getElementById('selected-date').textContent = 
        `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    
    try {
        const response = await fetch(`/api/transactions/date/${dateStr}`);
        const transactions = await response.json();
        
        const transactionsList = document.getElementById('day-transactions');
        transactionsList.innerHTML = '';
        
        if (transactions.length === 0) {
            transactionsList.innerHTML = '<p>この日の取引はありません</p>';
        } else {
            // 財布カテゴリ別収支を集計
            const walletSummary = {};
            
            transactions.forEach(transaction => {
                if (transaction.wallet_category_name) {
                    const walletName = transaction.wallet_category_name;
                    if (!walletSummary[walletName]) {
                        walletSummary[walletName] = { income: 0, expense: 0, net: 0 };
                    }
                    
                    if (transaction.type === 'income') {
                        walletSummary[walletName].income += parseFloat(transaction.amount);
                    } else if (transaction.type === 'expense') {
                        walletSummary[walletName].expense += parseFloat(transaction.amount);
                    }
                    walletSummary[walletName].net = walletSummary[walletName].income - walletSummary[walletName].expense;
                }
            });
            
            // 財布別収支サマリーを表示
            if (Object.keys(walletSummary).length > 0) {
                const summaryDiv = document.createElement('div');
                summaryDiv.className = 'wallet-summary';
                summaryDiv.innerHTML = '<h4>財布別収支</h4>';
                
                Object.entries(walletSummary).forEach(([walletName, summary]) => {
                    const walletItem = document.createElement('div');
                    walletItem.className = 'wallet-summary-item';
                    walletItem.innerHTML = `
                        <span class="wallet-name">${walletName}</span>
                        <span class="wallet-amounts">
                            収入: ¥${summary.income.toLocaleString()} 
                            支出: ¥${summary.expense.toLocaleString()} 
                            純額: <span class="${summary.net >= 0 ? 'positive' : 'negative'}">¥${summary.net.toLocaleString()}</span>
                        </span>
                    `;
                    summaryDiv.appendChild(walletItem);
                });
                
                transactionsList.appendChild(summaryDiv);
            }
            
            // 取引一覧を表示
            const transactionsDiv = document.createElement('div');
            transactionsDiv.innerHTML = '<h4>取引一覧</h4>';
            transactions.forEach(transaction => {
                const item = createTransactionItem(transaction);
                transactionsDiv.appendChild(item);
            });
            transactionsList.appendChild(transactionsDiv);
        }
        
        document.getElementById('day-detail').classList.remove('hidden');
    } catch (error) {
        console.error('日別取引データの読み込みに失敗しました:', error);
    }
}

// 取引項目の作成
function createTransactionItem(transaction) {
    const item = document.createElement('div');
    item.className = `transaction-item ${transaction.type}`;
    
    const info = document.createElement('div');
    info.className = 'transaction-info';
    
    const description = transaction.description || 
        (transaction.expense_category_name ? `${transaction.expense_category_name}` : '取引');
    
    // 財布・クレジット情報を構築
    const paymentInfo = [];
    if (transaction.wallet_category_name) {
        paymentInfo.push(`💳 ${transaction.wallet_category_name}`);
    }
    if (transaction.credit_category_name) {
        paymentInfo.push(`🏦 ${transaction.credit_category_name}`);
    }
    
    info.innerHTML = `
        <div class="transaction-description">${description}</div>
        ${paymentInfo.length > 0 ? `<div class="payment-info">${paymentInfo.join(' / ')}</div>` : ''}
        ${transaction.memo ? `<div class="transaction-memo">${transaction.memo}</div>` : ''}
        ${transaction.payment_location ? `<div class="payment-location">📍 ${transaction.payment_location}</div>` : ''}
    `;
    
    const amount = document.createElement('div');
    amount.className = `transaction-amount ${transaction.type}`;
    const sign = transaction.type === 'expense' ? '-' : '+';
    amount.textContent = `${sign}¥${transaction.amount.toLocaleString()}`;
    
    const actions = document.createElement('div');
    actions.className = 'transaction-actions';
    
    // レシート詳細ボタンを条件付きで追加
    const receiptBtn = (transaction.items && transaction.items.length > 0) ? 
        `<button class="receipt-btn" onclick="showReceiptDetails(${transaction.id})" title="レシート詳細">📄</button>` : '';
    
    actions.innerHTML = `
        ${receiptBtn}
        <button class="edit-btn" onclick="editTransaction(${transaction.id})" title="編集">✏️</button>
        <button class="delete-btn" onclick="deleteTransaction(${transaction.id})" title="削除">🗑️</button>
    `;
    
    item.appendChild(info);
    item.appendChild(amount);
    item.appendChild(actions);
    
    return item;
}

// 日付詳細ウィンドウを閉じる
function closeDayDetail() {
    document.getElementById('day-detail').classList.add('hidden');
}

// デフォルト日付の設定
function setDefaultDate() {
    const today = getCurrentLocalTime();
    document.getElementById('transaction-date').value = formatDateForJapan(today);
}

// 取引タイプに応じたフィールド表示切り替え
function toggleExpenseCategory() {
    const type = document.getElementById('transaction-type').value;
    const expenseCategoryGroup = document.getElementById('expense-category-group');
    const paymentMethodGroup = document.getElementById('payment-method-group');
    const walletCategoryGroup = document.getElementById('wallet-category-group');
    const creditCategoryGroup = document.getElementById('credit-category-group');
    const transferFromGroup = document.getElementById('transfer-from-group');
    const transferToGroup = document.getElementById('transfer-to-group');
    const chargeFromGroup = document.getElementById('charge-from-group');
    const chargeToGroup = document.getElementById('charge-to-group');
    const budgetFromGroup = document.getElementById('budget-from-group');
    const budgetToGroup = document.getElementById('budget-to-group');
    const itemsGroup = document.getElementById('items-group');
    
    if (type === 'expense' || type === 'income') {
        // 出費・収入の場合
        expenseCategoryGroup.style.display = type === 'expense' ? 'block' : 'none';
        
        if (type === 'expense') {
            // 支出の場合：支払い方法選択表示、商品詳細表示
            paymentMethodGroup.classList.remove('hidden');
            if (itemsGroup) itemsGroup.classList.remove('hidden');
        } else {
            // 収入の場合：支払い方法選択非表示、財布のみ表示、商品詳細非表示
            paymentMethodGroup.classList.add('hidden');
            walletCategoryGroup.classList.remove('hidden');
            creditCategoryGroup.classList.add('hidden');
            if (itemsGroup) itemsGroup.classList.add('hidden');
        }
        transferFromGroup.classList.add('hidden');
        transferToGroup.classList.add('hidden');
        chargeFromGroup.classList.add('hidden');
        chargeToGroup.classList.add('hidden');
        budgetFromGroup.classList.add('hidden');
        budgetToGroup.classList.add('hidden');
        
        // 支出の場合のみ支払い方法に応じた表示切り替え
        if (type === 'expense') {
            togglePaymentMethod();
        }
    } else if (type === 'transfer') {
        // 現金振替・引落の場合
        expenseCategoryGroup.style.display = 'none';
        paymentMethodGroup.classList.add('hidden');
        walletCategoryGroup.classList.add('hidden');
        creditCategoryGroup.classList.add('hidden');
        transferFromGroup.classList.remove('hidden');
        transferToGroup.classList.remove('hidden');
        chargeFromGroup.classList.add('hidden');
        chargeToGroup.classList.add('hidden');
        budgetFromGroup.classList.add('hidden');
        budgetToGroup.classList.add('hidden');
        if (itemsGroup) itemsGroup.classList.add('hidden');
    } else if (type === 'charge') {
        // チャージの場合
        expenseCategoryGroup.style.display = 'none';
        paymentMethodGroup.classList.add('hidden');
        walletCategoryGroup.classList.add('hidden');
        creditCategoryGroup.classList.add('hidden');
        transferFromGroup.classList.add('hidden');
        transferToGroup.classList.add('hidden');
        chargeFromGroup.classList.remove('hidden');
        chargeToGroup.classList.remove('hidden');
        budgetFromGroup.classList.add('hidden');
        budgetToGroup.classList.add('hidden');
        if (itemsGroup) itemsGroup.classList.add('hidden');
        
        // チャージでデフォルトで楽天カードを選択
        const chargeFromSourceSelect = document.getElementById('charge-from-source');
        if (chargeFromSourceSelect) {
            // 楽天カードのオプションを探して選択
            for (let option of chargeFromSourceSelect.options) {
                if (option.text.includes('楽天カード')) {
                    chargeFromSourceSelect.value = option.value;
                    break;
                }
            }
        }
    } else if (type === 'budget_transfer') {
        // 予算振替の場合
        expenseCategoryGroup.style.display = 'none';
        paymentMethodGroup.classList.add('hidden');
        walletCategoryGroup.classList.add('hidden');
        creditCategoryGroup.classList.add('hidden');
        transferFromGroup.classList.add('hidden');
        transferToGroup.classList.add('hidden');
        chargeFromGroup.classList.add('hidden');
        chargeToGroup.classList.add('hidden');
        budgetFromGroup.classList.remove('hidden');
        budgetToGroup.classList.remove('hidden');
        if (itemsGroup) itemsGroup.classList.add('hidden');
    }
}

// 支払い方法の切り替え
function togglePaymentMethod() {
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    const walletGroup = document.getElementById('wallet-category-group');
    const creditGroup = document.getElementById('credit-category-group');
    
    if (paymentMethod === 'wallet') {
        walletGroup.classList.remove('hidden');
        creditGroup.classList.add('hidden');
    } else {
        walletGroup.classList.add('hidden');
        creditGroup.classList.remove('hidden');
    }
}

function toggleReceiptPaymentMethod() {
    const paymentMethod = document.querySelector('input[name="receipt-payment-method"]:checked').value;
    const walletGroup = document.getElementById('receipt-wallet-group');
    const creditGroup = document.getElementById('receipt-credit-group');
    
    if (paymentMethod === 'wallet') {
        walletGroup.classList.remove('hidden');
        creditGroup.classList.add('hidden');
    } else {
        walletGroup.classList.add('hidden');
        creditGroup.classList.remove('hidden');
    }
}

// 取引登録
async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const transactionType = document.getElementById('transaction-type').value;
    const transactionData = {
        date: document.getElementById('transaction-date').value,
        amount: parseFloat(document.getElementById('transaction-amount').value),
        type: transactionType,
        description: document.getElementById('transaction-description').value,
        memo: document.getElementById('transaction-memo').value,
        payment_location: document.getElementById('payment-location').value,
        notes: document.getElementById('transaction-notes').value
    };
    
    if (transactionType === 'transfer') {
        // 現金振替・引落の場合
        const transferFromId = parseInt(document.getElementById('transfer-from').value);
        const transferToValue = document.getElementById('transfer-to').value;
        
        if (transferToValue !== 'withdrawal' && transferFromId === parseInt(transferToValue)) {
            alert('振替元と振替先が同じです。異なる財布を選択してください。');
            return;
        }
        
        transactionData.transfer_from_wallet_id = transferFromId;
        transactionData.transfer_to_wallet_id = transferToValue;
        
        if (transferToValue === 'withdrawal') {
            transactionData.description = transactionData.description || '引落処理';
        } else {
            transactionData.description = transactionData.description || '現金振替・引落';
        }
    } else if (transactionType === 'charge') {
        // チャージの場合
        const chargeFromSourceValue = document.getElementById('charge-from-source').value;
        const chargeToWalletId = parseInt(document.getElementById('charge-to-wallet').value);
        
        // チャージ元がクレジットか財布かを判定
        if (chargeFromSourceValue.startsWith('credit_')) {
            transactionData.charge_from_credit_id = parseInt(chargeFromSourceValue.replace('credit_', ''));
            transactionData.description = transactionData.description || 'クレジットチャージ';
        } else if (chargeFromSourceValue.startsWith('wallet_')) {
            transactionData.charge_from_wallet_id = parseInt(chargeFromSourceValue.replace('wallet_', ''));
            transactionData.description = transactionData.description || '財布チャージ';
        }
        
        transactionData.charge_to_wallet_id = chargeToWalletId;
    } else if (transactionType === 'budget_transfer') {
        // 予算振替の場合
        const budgetFromCategoryId = parseInt(document.getElementById('budget-from-category').value);
        const budgetToCategoryId = parseInt(document.getElementById('budget-to-category').value);
        
        if (budgetFromCategoryId === budgetToCategoryId) {
            alert('振替元と振替先の予算カテゴリが同じです。異なるカテゴリを選択してください。');
            return;
        }
        
        transactionData.budget_from_category_id = budgetFromCategoryId;
        transactionData.budget_to_category_id = budgetToCategoryId;
        transactionData.description = transactionData.description || '予算間振替';
    } else {
        // 出費・収入の場合
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value;
        
        if (transactionType === 'expense') {
            transactionData.expense_category_id = parseInt(document.getElementById('expense-category').value);
        }
        
        if (paymentMethod === 'wallet') {
            transactionData.wallet_category_id = parseInt(document.getElementById('wallet-category').value);
        } else if (paymentMethod === 'credit') {
            transactionData.credit_category_id = parseInt(document.getElementById('credit-category').value);
        }
        
        // 商品詳細を収集
        const itemRows = document.querySelectorAll('.item-row');
        const items = [];
        itemRows.forEach(row => {
            const name = row.querySelector('.item-name').value;
            const amount = parseFloat(row.querySelector('.item-amount').value);
            const categoryId = parseInt(row.querySelector('.item-category').value);
            
            if (name && amount > 0) {
                items.push({
                    name: name,
                    amount: amount,
                    expense_category_id: categoryId || null
                });
            }
        });
        
        if (items.length > 0) {
            transactionData.items = items;
        }
    }
    
    try {
        const form = e.target;
        const editingId = form.getAttribute('data-editing-id');
        const isEditing = !!editingId;
        
        let response;
        if (isEditing) {
            // 編集モード - PUT リクエスト
            response = await fetch(`/api/transactions/${editingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transactionData)
            });
        } else {
            // 新規作成モード - POST リクエスト
            response = await fetch('/api/transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transactionData)
            });
        }
        
        const result = await response.json();
        
        if (response.ok) {
            alert(isEditing ? '取引を更新しました' : '取引を登録しました');
            if (!isEditing) {
                lastTransaction = result;
            }
            
            // 編集モードの場合はキャンセル処理
            if (isEditing) {
                cancelEdit();
            } else {
                // 選択値を保持してからリセット
                const selectedValues = {
                    expenseCategory: document.getElementById('expense-category').value,
                    walletCategory: document.getElementById('wallet-category').value,
                    creditCategory: document.getElementById('credit-category').value,
                    paymentMethod: document.querySelector('input[name="payment-method"]:checked')?.value,
                    transferFrom: document.getElementById('transfer-from').value,
                    transferTo: document.getElementById('transfer-to').value,
                    chargeFromSource: document.getElementById('charge-from-source').value,
                    chargeToWallet: document.getElementById('charge-to-wallet').value,
                    budgetFromCategory: document.getElementById('budget-from-category').value,
                    budgetToCategory: document.getElementById('budget-to-category').value
                };
                
                // フォームをリセット
                form.reset();
                setDefaultDate();
                
                // 保持した値を復元
                if (selectedValues.expenseCategory) {
                    document.getElementById('expense-category').value = selectedValues.expenseCategory;
                }
                if (selectedValues.walletCategory) {
                    document.getElementById('wallet-category').value = selectedValues.walletCategory;
                }
                if (selectedValues.creditCategory) {
                    document.getElementById('credit-category').value = selectedValues.creditCategory;
                }
                if (selectedValues.paymentMethod) {
                    const paymentRadio = document.querySelector(`input[name="payment-method"][value="${selectedValues.paymentMethod}"]`);
                    if (paymentRadio) paymentRadio.checked = true;
                }
                if (selectedValues.transferFrom) {
                    document.getElementById('transfer-from').value = selectedValues.transferFrom;
                }
                if (selectedValues.transferTo) {
                    document.getElementById('transfer-to').value = selectedValues.transferTo;
                }
                if (selectedValues.chargeFromSource) {
                    document.getElementById('charge-from-source').value = selectedValues.chargeFromSource;
                }
                if (selectedValues.chargeToWallet) {
                    document.getElementById('charge-to-wallet').value = selectedValues.chargeToWallet;
                }
                if (selectedValues.budgetFromCategory) {
                    document.getElementById('budget-from-category').value = selectedValues.budgetFromCategory;
                }
                if (selectedValues.budgetToCategory) {
                    document.getElementById('budget-to-category').value = selectedValues.budgetToCategory;
                }
                
                // 商品行をクリア
                document.getElementById('items-container').innerHTML = '';
                
                // 決済場所の候補も非表示
                hideSuggestions();
            }
            
            // カレンダーを更新
            showCalendar();
            
            // 選択中の日付があれば詳細を更新
            if (selectedDate) {
                showDayDetail(selectedDate);
            }
            
            // カテゴリデータを再読み込み（残高が更新されているため）
            await loadCategories();
        } else {
            console.error('Server Error Response:', result);
            alert('取引の登録に失敗しました: ' + (result.error || 'サーバーエラー'));
        }
    } catch (error) {
        console.error('取引登録エラー:', error);
        alert('取引の登録に失敗しました: ' + error.message);
    }
}

// 1つ戻る機能
async function undoLastTransaction() {
    if (!lastTransaction) {
        alert('戻る取引がありません');
        return;
    }
    
    if (!confirm('最後の取引を削除しますか？')) {
        return;
    }
    
    try {
        // TODO: 削除APIの実装が必要
        alert('削除機能は今後実装予定です');
    } catch (error) {
        console.error('取引削除エラー:', error);
        alert('取引の削除に失敗しました');
    }
}

// 年月選択肢の設定
function populateYearMonthSelectors() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 2; i <= currentYear + 1; i++) {
        years.push(i);
    }
    
    const months = [];
    for (let i = 1; i <= 12; i++) {
        months.push(i);
    }
    
    // 予算設定用
    const budgetYear = document.getElementById('budget-year');
    const budgetMonth = document.getElementById('budget-month');
    
    years.forEach(year => {
        budgetYear.add(new Option(year + '年', year));
    });
    
    months.forEach(month => {
        budgetMonth.add(new Option(month + '月', month));
    });
    
    // 集計用
    const summaryYear = document.getElementById('summary-year');
    const summaryMonth = document.getElementById('summary-month');
    
    years.forEach(year => {
        summaryYear.add(new Option(year + '年', year));
    });
    
    months.forEach(month => {
        summaryMonth.add(new Option(month + '月', month));
    });
    
    // 現在の年月を選択
    const currentMonth = new Date().getMonth() + 1;
    budgetYear.value = currentYear;
    budgetMonth.value = currentMonth;
    summaryYear.value = currentYear;
    summaryMonth.value = currentMonth;
}

// 予算読み込み
async function loadBudget() {
    const year = document.getElementById('budget-year').value;
    const month = document.getElementById('budget-month').value;
    
    try {
        const response = await fetch(`/api/budgets/${year}/${month}`);
        const budgets = await response.json();
        
        const budgetList = document.getElementById('budget-list');
        budgetList.innerHTML = '';
        
        // 累計予算額を計算
        let totalBudget = 0;
        
        // 保存された順序で並び替え
        const sortedCategories = loadItemOrder('#budget-list', expenseCategories, 'category.name');
        
        sortedCategories.forEach((category, index) => {
            const budget = budgets.find(b => b.expense_category_id === category.id);
            const budgetAmount = budget ? budget.budget_amount : 0;
            totalBudget += budgetAmount;
            
            const item = document.createElement('div');
            item.className = 'budget-item';
            item.draggable = true;
            item.dataset.categoryId = category.id;
            item.dataset.categoryName = category.name;
            item.dataset.index = index;
            item.innerHTML = `
                <label>${category.name}</label>
                <input type="number" data-category-id="${category.id}" value="${budgetAmount}" min="0" step="1000">
            `;
            
            // ドラッグ&ドロップイベント
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
            
            budgetList.appendChild(item);
        });
        
        // 累計予算額を表示
        document.getElementById('budget-total').textContent = `¥${totalBudget.toLocaleString()}`;
    } catch (error) {
        console.error('予算読み込みエラー:', error);
        alert('予算の読み込みに失敗しました');
    }
}

// 予算保存
async function saveBudget() {
    const year = document.getElementById('budget-year').value;
    const month = document.getElementById('budget-month').value;
    const budgetInputs = document.querySelectorAll('#budget-list input');
    
    try {
        for (const input of budgetInputs) {
            const categoryId = input.getAttribute('data-category-id');
            const budgetAmount = parseFloat(input.value) || 0;
            
            await fetch('/api/budgets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    year: parseInt(year),
                    month: parseInt(month),
                    expense_category_id: parseInt(categoryId),
                    budget_amount: budgetAmount
                })
            });
        }
        
        alert('予算を保存しました');
        // 予算保存後にプルダウンを更新
        await populateSelects();
    } catch (error) {
        console.error('予算保存エラー:', error);
        alert('予算の保存に失敗しました');
    }
}

// 前月引継ぎ
async function copyPreviousMonthBudget() {
    const year = parseInt(document.getElementById('budget-year').value);
    const month = parseInt(document.getElementById('budget-month').value);
    
    if (!year || !month) {
        alert('年月を選択してください');
        return;
    }
    
    // 前月を計算
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) {
        prevMonth = 12;
        prevYear = year - 1;
    }
    
    if (!confirm(`${prevYear}年${prevMonth}月の予算を${year}年${month}月にコピーしますか？\n現在の予算設定は上書きされます。`)) {
        return;
    }
    
    try {
        // 前月の予算データを取得
        const response = await fetch(`/api/budgets/${prevYear}/${prevMonth}`);
        const prevBudgets = await response.json();
        
        if (prevBudgets.length === 0) {
            alert(`${prevYear}年${prevMonth}月の予算データが存在しません`);
            return;
        }
        
        // 現在の月に前月の予算データをコピー
        for (const budget of prevBudgets) {
            await fetch('/api/budgets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    year: year,
                    month: month,
                    expense_category_id: budget.expense_category_id,
                    budget_amount: budget.budget_amount
                })
            });
        }
        
        alert(`${prevYear}年${prevMonth}月の予算を引き継ぎました`);
        
        // 画面を更新
        await loadBudget();
        await populateSelects();
        
    } catch (error) {
        console.error('前月引継ぎエラー:', error);
        alert('前月の予算引き継ぎに失敗しました');
    }
}

// レシートアップロード設定
function setupReceiptUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('receipt-file');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleReceiptFile(files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleReceiptFile(e.target.files[0]);
        }
    });
}

// レシートファイル処理
async function handleReceiptFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください');
        return;
    }
    
    const formData = new FormData();
    formData.append('receipt', file);
    
    try {
        const response = await fetch('/api/analyze-receipt', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayReceiptResult(result);
        } else {
            alert('レシートの解析に失敗しました: ' + result.error);
        }
    } catch (error) {
        console.error('レシート解析エラー:', error);
        alert('レシートの解析に失敗しました');
    }
}

// レシート解析結果の表示
function displayReceiptResult(result) {
    console.log('🔍 displayReceiptResult 受信データ全体:', result);
    console.log('🏪 store_name:', result.store_name);
    console.log('🛍️ items配列:', result.items);
    console.log('🥇 最初のitem:', result.items?.[0]);
    
    const receiptData = document.getElementById('receipt-data');
    const receiptResult = document.getElementById('receipt-result');
    
    receiptData.innerHTML = `
        <h4>解析結果</h4>
        <p><strong>店舗名:</strong> ${result.store_name || '不明'}</p>
        <p><strong>日付:</strong> ${result.date || '不明'}</p>
        <p><strong>合計金額:</strong> ¥${result.total_amount?.toLocaleString() || 0}</p>
        <p><strong>推奨カテゴリ:</strong> ${result.suggested_category || '不明'}</p>
    `;
    
    // 項目詳細調整セクションを表示
    if (result.items && result.items.length > 0) {
        displayReceiptItemsAdjustment(result.items, result.suggested_category, result.store_name);
        // 上部の合計金額を項目調整後の合計に同期
        updateMainReceiptTotal();
    }
    
    // 決済場所に店舗名を自動設定
    if (result.store_name) {
        const paymentLocationInput = document.getElementById('receipt-wallet-category').parentElement.parentElement.querySelector('input[type="text"]');
        if (!paymentLocationInput) {
            // レシート解析用の決済場所フィールドを作成
            const receiptPaymentLocationGroup = document.createElement('div');
            receiptPaymentLocationGroup.className = 'form-group';
            receiptPaymentLocationGroup.innerHTML = `
                <label for="receipt-payment-location">決済場所</label>
                <input type="text" id="receipt-payment-location" value="${result.store_name}" placeholder="店舗名・場所を入力">
            `;
            
            const receiptWalletGroup = document.getElementById('receipt-wallet-group');
            receiptWalletGroup.parentElement.insertBefore(receiptPaymentLocationGroup, receiptWalletGroup);
        } else {
            paymentLocationInput.value = result.store_name;
        }
    }
    
    // 推奨カテゴリを選択
    if (result.suggested_category) {
        const category = expenseCategories.find(c => c.name === result.suggested_category);
        if (category) {
            // レシート用のデータを保存
            receiptResult.setAttribute('data-category-id', category.id);
            receiptResult.setAttribute('data-amount', result.total_amount);
            receiptResult.setAttribute('data-description', result.store_name || 'レシート取引');
            // 日本時間での日付文字列を生成
            let defaultDate;
            if (!result.date) {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                defaultDate = `${year}-${month}-${day}`;
            }
            receiptResult.setAttribute('data-date', result.date || defaultDate);
            receiptResult.setAttribute('data-store-name', result.store_name || '');
            
            // 商品データも保存
            if (result.items && result.items.length > 0) {
                receiptResult.setAttribute('data-items', JSON.stringify(result.items));
            }
        }
    }
    
    receiptResult.classList.remove('hidden');
}

// レシート項目をフィルタリング（店舗名や不要な項目を除去）
function filterReceiptItems(items) {
    if (!items || items.length === 0) return [];
    
    // 店舗名として一般的なキーワード
    const storeKeywords = [
        '店', 'ストア', 'shop', 'store', 'market', 'mart', '薬局', 'ドラッグ', 
        '合計', '小計', '税込', '税抜', 'total', 'subtotal', '計', '円'
    ];
    
    // 不要な項目を除外し、有効な商品のみを返す
    return items.filter(item => {
        if (!item.name || !item.amount) return false;
        
        const itemName = item.name.toLowerCase();
        const amount = parseFloat(item.amount);
        
        // 金額が0以下は除外
        if (amount <= 0) return false;
        
        // 店舗名キーワードが含まれる項目は除外
        const hasStoreKeyword = storeKeywords.some(keyword => 
            itemName.includes(keyword.toLowerCase())
        );
        
        // 1文字以下の商品名は除外
        if (item.name.trim().length <= 1) return false;
        
        // 数字のみの商品名は除外
        if (/^\d+$/.test(item.name.trim())) return false;
        
        return !hasStoreKeyword;
    }).map(item => ({
        name: item.name.trim(),
        amount: parseFloat(item.amount) || 0
    }));
}

// レシート項目詳細調整の表示
function displayReceiptItemsAdjustment(items, suggestedCategory, storeName) {
    console.log('displayReceiptItemsAdjustment 受信データ:', {
        items: items,
        suggestedCategory: suggestedCategory,
        storeName: storeName,
        items_length: items?.length,
        first_item: items?.[0]
    });
    
    const itemsSection = document.getElementById('receipt-items-section');
    const itemsList = document.getElementById('receipt-items-list');
    
    itemsList.innerHTML = '';
    
    // デフォルトカテゴリIDを取得
    const defaultCategoryId = expenseCategories.find(c => c.name === suggestedCategory)?.id || expenseCategories[0]?.id;
    
    // 最終チェック: 最初の商品名が店舗名と一致する場合の応急処置
    console.log('🔍 元のitemsデータ:', items);
    console.log('🔍 最初のitem詳細:', items[0]);
    
    let finalItems = [...items]; // 元の配列を変更しないようにコピー
    
    console.log('🔍 コピー後のfinalItems:', finalItems);
    console.log('🔍 コピー後の最初のitem:', finalItems[0]);
    
    if (finalItems.length > 0 && storeName) {
        console.log('🔍 店舗名チェック:', {
            storeName: storeName,
            firstItemName: finalItems[0]?.name,
            isExactMatch: storeName === finalItems[0]?.name
        });
        
        // 直接渡された店舗名で照合
        if (finalItems[0]) {
            const firstItemName = finalItems[0].name;
            const isStoreName = (
                firstItemName === storeName ||
                firstItemName.includes(storeName) ||
                storeName.includes(firstItemName) ||
                // 店舗名特有のパターン
                /ヤオコー|セブンイレブン|ファミマ|ローソン|スーパー|マート|ストア|コンビニ|薬局|ドラッグ/i.test(firstItemName)
            );
            
            if (isStoreName) {
                console.log('🚨 フロントエンド緊急修正: 最初のアイテムが店舗名と判定され除去');
                console.log('店舗名:', storeName);
                console.log('除去対象:', finalItems[0]);
                console.log('残りのアイテム数:', finalItems.length - 1);
                finalItems = finalItems.slice(1);
            }
        }
    }
    
    console.log('🎯 最終的に表示するアイテム一覧:');
    finalItems.forEach((item, i) => {
        console.log(`  [${i}] ${item.name} - ¥${item.amount}`);
    });
    
    finalItems.forEach((item, index) => {
        console.log(`🏗️ UI作成中 [${index}]:`, item);
        
        const itemRow = document.createElement('div');
        itemRow.className = 'receipt-item-row';
        itemRow.setAttribute('data-index', index);
        
        console.log(`🔍 HTML生成前の商品名チェック [${index}]:`, {
            itemName: item.name,
            itemAmount: item.amount,
            storeName: storeName
        });
        
        // セキュリティ: HTMLエスケープを行う
        const escapedName = String(item.name || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const escapedAmount = parseFloat(item.amount || 0);
        
        console.log(`🔍 エスケープ後の商品名 [${index}]:`, escapedName);
        
        itemRow.innerHTML = `
            <div class="item-name">
                <label class="mobile-label">商品名</label>
                <input type="text" value="${escapedName}" placeholder="商品名を入力" class="receipt-item-name">
            </div>
            <div class="item-amount">
                <label class="mobile-label">金額</label>
                <input type="number" value="${escapedAmount}" placeholder="0" class="receipt-item-amount" min="0" step="1">
            </div>
            <div class="item-category">
                <label class="mobile-label">カテゴリ</label>
                <select class="receipt-item-category">
                    ${expenseCategories.map(category => 
                        `<option value="${category.id}" ${category.id == defaultCategoryId ? 'selected' : ''}>${category.name}</option>`
                    ).join('')}
                </select>
            </div>
            <button type="button" class="remove-item" onclick="removeReceiptItem(${index})">削除</button>
        `;
        
        console.log(`🔍 HTML生成後のDOM確認 [${index}]:`);
        const nameInput = itemRow.querySelector('.receipt-item-name');
        console.log(`  input[type=text].value: "${nameInput.value}"`);
        
        itemsList.appendChild(itemRow);
        
        // DOM追加後の最終確認
        setTimeout(() => {
            const addedRow = itemsList.querySelector(`[data-index="${index}"] .receipt-item-name`);
            console.log(`🔍 DOM追加後の最終確認 [${index}]: "${addedRow?.value}"`);
        }, 0);
    });
    
    // 項目追加ボタン
    const addItemBtn = document.createElement('button');
    addItemBtn.type = 'button';
    addItemBtn.className = 'btn-secondary';
    addItemBtn.textContent = '項目追加';
    addItemBtn.onclick = addReceiptItem;
    
    itemsList.appendChild(addItemBtn);
    
    // 合計金額を更新
    updateReceiptTotal();
    
    // 金額変更時のイベントリスナーを追加
    itemsList.addEventListener('input', (e) => {
        if (e.target.classList.contains('receipt-item-amount')) {
            updateReceiptTotal();
        }
    });
    
    itemsSection.classList.remove('hidden');
}

// レシート項目を削除
function removeReceiptItem(index) {
    const itemRow = document.querySelector(`[data-index="${index}"]`);
    if (itemRow) {
        itemRow.remove();
        updateReceiptTotal(); // これで上部の合計も自動更新される
        // インデックスを再割り当て
        updateReceiptItemIndices();
    }
}

// レシート項目を追加
function addReceiptItem() {
    const itemsList = document.getElementById('receipt-items-list');
    const addButton = itemsList.querySelector('.btn-secondary');
    
    // 新しいインデックスを取得
    const nextIndex = itemsList.querySelectorAll('.receipt-item-row').length;
    
    const itemRow = document.createElement('div');
    itemRow.className = 'receipt-item-row';
    itemRow.setAttribute('data-index', nextIndex);
    
    itemRow.innerHTML = `
        <div class="item-name">
            <label class="mobile-label">商品名</label>
            <input type="text" value="" placeholder="商品名を入力" class="receipt-item-name">
        </div>
        <div class="item-amount">
            <label class="mobile-label">金額</label>
            <input type="number" value="0" placeholder="0" class="receipt-item-amount" min="0" step="1">
        </div>
        <div class="item-category">
            <label class="mobile-label">カテゴリ</label>
            <select class="receipt-item-category">
                ${expenseCategories.map(category => 
                    `<option value="${category.id}" ${category.id == expenseCategories[0]?.id ? 'selected' : ''}>${category.name}</option>`
                ).join('')}
            </select>
        </div>
        <button type="button" class="remove-item" onclick="removeReceiptItem(${nextIndex})">削除</button>
    `;
    
    itemsList.insertBefore(itemRow, addButton);
    updateReceiptTotal(); // これで上部の合計も自動更新される
}

// レシート項目のインデックスを更新
function updateReceiptItemIndices() {
    const itemRows = document.querySelectorAll('.receipt-item-row');
    itemRows.forEach((row, index) => {
        row.setAttribute('data-index', index);
        const removeBtn = row.querySelector('.remove-item');
        removeBtn.setAttribute('onclick', `removeReceiptItem(${index})`);
    });
}

// レシート合計金額を更新
function updateReceiptTotal() {
    const amountInputs = document.querySelectorAll('.receipt-item-amount');
    let total = 0;
    
    amountInputs.forEach(input => {
        const amount = parseFloat(input.value) || 0;
        total += amount;
    });
    
    document.getElementById('receipt-total-amount').textContent = `¥${total.toLocaleString()}`;
    
    // 上部の解析結果の合計金額も同期更新
    updateMainReceiptTotal();
}

// 上部の解析結果の合計金額を更新
function updateMainReceiptTotal() {
    const amountInputs = document.querySelectorAll('.receipt-item-amount');
    let total = 0;
    
    amountInputs.forEach(input => {
        const amount = parseFloat(input.value) || 0;
        total += amount;
    });
    
    // 上部の合計金額表示を更新
    const receiptData = document.getElementById('receipt-data');
    const totalElement = receiptData.querySelector('p:nth-child(4)'); // 合計金額の行
    if (totalElement) {
        totalElement.innerHTML = `<strong>合計金額:</strong> ¥${total.toLocaleString()} <span style="color: #28a745; font-size: 0.9em;">(調整済み)</span>`;
    }
}

// 調整されたレシート項目データを取得
function getReceiptAdjustedItems() {
    const itemRows = document.querySelectorAll('.receipt-item-row');
    const items = [];
    
    itemRows.forEach(row => {
        const nameInput = row.querySelector('.receipt-item-name');
        const amountInput = row.querySelector('.receipt-item-amount');
        const categorySelect = row.querySelector('.receipt-item-category');
        
        if (nameInput && amountInput && categorySelect) {
            const name = nameInput.value.trim();
            const amount = parseFloat(amountInput.value) || 0;
            const categoryId = parseInt(categorySelect.value);
            
            if (name && amount > 0) {
                items.push({
                    name: name,
                    amount: amount,
                    expense_category_id: categoryId
                });
            }
        }
    });
    
    return items;
}

// レシート取引登録
async function registerReceiptTransaction() {
    const receiptResult = document.getElementById('receipt-result');
    const paymentMethod = document.querySelector('input[name="receipt-payment-method"]:checked').value;
    
    // 決済場所を取得
    const paymentLocationInput = document.getElementById('receipt-payment-location');
    const paymentLocation = paymentLocationInput ? paymentLocationInput.value : receiptResult.getAttribute('data-store-name');
    
    // 調整された項目データを取得
    const receiptItems = getReceiptAdjustedItems();
    const totalAmount = receiptItems.reduce((sum, item) => sum + item.amount, 0);
    
    const transactionData = {
        date: receiptResult.getAttribute('data-date'),
        amount: totalAmount,
        type: 'expense',
        expense_category_id: parseInt(receiptResult.getAttribute('data-category-id')),
        description: receiptResult.getAttribute('data-description'),
        memo: 'レシート解析による自動登録（項目調整済み）',
        payment_location: paymentLocation,
        notes: 'レシート画像から自動解析・項目調整済み',
        items: receiptItems
    };
    
    if (paymentMethod === 'wallet') {
        transactionData.wallet_category_id = parseInt(document.getElementById('receipt-wallet-category').value);
    } else {
        transactionData.credit_category_id = parseInt(document.getElementById('receipt-credit-category').value);
    }
    
    try {
        const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transactionData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('レシート取引を登録しました');
            
            // 結果をクリア
            receiptResult.classList.add('hidden');
            document.getElementById('receipt-file').value = '';
            
            // カレンダーを更新
            showCalendar();
            
            // カテゴリデータを再読み込み
            await loadCategories();
        } else {
            alert('取引の登録に失敗しました: ' + result.error);
        }
    } catch (error) {
        console.error('レシート取引登録エラー:', error);
        alert('取引の登録に失敗しました');
    }
}

// 集計読み込み
async function loadSummary() {
    const year = document.getElementById('summary-year').value;
    const month = document.getElementById('summary-month').value;
    
    try {
        const response = await fetch(`/api/summary/${year}/${month}`);
        const summary = await response.json();
        
        // 出費カテゴリ別集計
        const expenseSummaryList = document.getElementById('expense-summary-list');
        expenseSummaryList.innerHTML = '';
        
        // 保存された順序で並び替え
        const sortedExpenseItems = loadItemOrder('#expense-summary-list', summary.expenseSummary, 'category.name');
        
        sortedExpenseItems.forEach((item, index) => {
            const summaryItem = document.createElement('div');
            summaryItem.className = 'summary-item';
            summaryItem.draggable = true;
            summaryItem.dataset.index = index;
            
            const remaining = item.remaining;
            const remainingClass = remaining >= 0 ? 'positive' : 'negative';
            
            summaryItem.innerHTML = `
                <div class="category">${item.category}</div>
                <div class="amounts">
                    <div>使用額: ¥${item.total.toLocaleString()}</div>
                    <div class="budget">予算: ¥${item.budget.toLocaleString()}</div>
                    <div class="remaining ${remainingClass}">残額: ¥${remaining.toLocaleString()}</div>
                </div>
            `;
            
            // ドラッグ&ドロップイベント
            summaryItem.addEventListener('dragstart', handleDragStart);
            summaryItem.addEventListener('dragend', handleDragEnd);
            summaryItem.addEventListener('dragover', handleDragOver);
            summaryItem.addEventListener('drop', handleDrop);
            
            expenseSummaryList.appendChild(summaryItem);
        });
        
        // クレジット使用額集計
        const creditSummaryList = document.getElementById('credit-summary-list');
        creditSummaryList.innerHTML = '';
        
        // クレジット使用額合計を計算
        const totalCreditUsage = summary.creditSummary.reduce((sum, item) => sum + item.total, 0);
        document.getElementById('credit-total').textContent = `¥${totalCreditUsage.toLocaleString()}`;
        
        // 保存された順序で並び替え
        const sortedCreditItems = loadItemOrder('#credit-summary-list', summary.creditSummary, 'category.name');
        
        sortedCreditItems.forEach((item, index) => {
            const summaryItem = document.createElement('div');
            summaryItem.className = 'summary-item';
            summaryItem.draggable = true;
            summaryItem.dataset.index = index;
            
            summaryItem.innerHTML = `
                <div class="category">${item.category}</div>
                <div class="amounts">
                    <div>使用額: ¥${item.total.toLocaleString()}</div>
                </div>
            `;
            
            // ドラッグ&ドロップイベント
            summaryItem.addEventListener('dragstart', handleDragStart);
            summaryItem.addEventListener('dragend', handleDragEnd);
            summaryItem.addEventListener('dragover', handleDragOver);
            summaryItem.addEventListener('drop', handleDrop);
            
            creditSummaryList.appendChild(summaryItem);
        });
        
    } catch (error) {
        console.error('集計読み込みエラー:', error);
        alert('集計の読み込みに失敗しました');
    }
}

// 財布残高読み込み
async function loadWalletBalances() {
    try {
        const response = await fetch('/api/wallet-categories');
        const wallets = await response.json();
        
        const walletList = document.getElementById('wallet-list');
        walletList.innerHTML = '';
        
        // 累計金額を計算
        const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
        document.getElementById('wallet-total').textContent = `¥${totalBalance.toLocaleString()}`;
        
        // 保存された順序で並び替え
        const sortedWallets = loadItemOrder('#wallet-list', wallets, 'wallet.id');
        
        sortedWallets.forEach((wallet, index) => {
            const walletItem = document.createElement('div');
            walletItem.className = 'wallet-item';
            walletItem.draggable = true;
            walletItem.dataset.walletId = wallet.id;
            walletItem.dataset.index = index;
            
            walletItem.innerHTML = `
                <label>${wallet.name}</label>
                <input type="number" value="${wallet.balance}" data-wallet-id="${wallet.id}" step="0.01">
                <div class="current-balance">¥${wallet.balance.toLocaleString()}</div>
                <button onclick="updateWalletBalance(${wallet.id})" class="btn-primary">更新</button>
            `;
            
            // ドラッグ&ドロップイベント
            walletItem.addEventListener('dragstart', handleDragStart);
            walletItem.addEventListener('dragend', handleDragEnd);
            walletItem.addEventListener('dragover', handleDragOver);
            walletItem.addEventListener('drop', handleDrop);
            
            walletList.appendChild(walletItem);
        });
        
    } catch (error) {
        console.error('財布残高読み込みエラー:', error);
        alert('財布残高の読み込みに失敗しました');
    }
}

// ドラッグ&ドロップハンドラ
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedElement = null;
    // すべての要素からdrag-overクラスを削除
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        const parent = this.parentNode;
        const draggedIndex = Array.from(parent.children).indexOf(draggedElement);
        const dropIndex = Array.from(parent.children).indexOf(this);
        
        if (draggedIndex < dropIndex) {
            parent.insertBefore(draggedElement, this.nextSibling);
        } else {
            parent.insertBefore(draggedElement, this);
        }
        
        // 順序変更を保存
        saveItemOrder(parent);
    }
    return false;
}

// 順序管理関数群
function saveItemOrder(container) {
    const containerId = container.id;
    const items = Array.from(container.children);
    let order = [];
    
    // コンテナごとに異なる識別子を取得
    if (containerId === 'wallet-list') {
        order = items.map(item => {
            const input = item.querySelector('input[data-wallet-id]');
            return input ? input.dataset.walletId : null;
        }).filter(id => id !== null);
        localStorage.setItem('walletOrder', JSON.stringify(order));
    } else if (containerId === 'budget-list') {
        order = items.map(item => {
            const label = item.querySelector('label');
            return label ? label.textContent : null;
        }).filter(name => name !== null);
        localStorage.setItem('expenseCategoryOrder', JSON.stringify(order));
    } else if (containerId === 'expense-summary-list') {
        order = items.map(item => {
            const categoryDiv = item.querySelector('.category');
            return categoryDiv ? categoryDiv.textContent : null;
        }).filter(name => name !== null);
        localStorage.setItem('expenseCategoryOrder', JSON.stringify(order));
    } else if (containerId === 'credit-summary-list') {
        order = items.map(item => {
            const categoryDiv = item.querySelector('.category');
            return categoryDiv ? categoryDiv.textContent : null;
        }).filter(name => name !== null);
        localStorage.setItem('creditSummaryOrder', JSON.stringify(order));
    }
    
    console.log(`順序を保存しました (${containerId}):`, order);
}

function loadItemOrder(containerSelector, items, keyProperty) {
    const storageKey = getStorageKeyForContainer(containerSelector);
    const savedOrder = localStorage.getItem(storageKey);
    
    if (!savedOrder) {
        return items;
    }
    
    try {
        const order = JSON.parse(savedOrder);
        const sortedItems = [];
        
        // 保存された順序に従って並び替え
        order.forEach(key => {
            const item = items.find(item => getItemKey(item, keyProperty) === key);
            if (item) {
                sortedItems.push(item);
            }
        });
        
        // 新しく追加された項目があれば最後に追加
        items.forEach(item => {
            if (!sortedItems.includes(item)) {
                sortedItems.push(item);
            }
        });
        
        return sortedItems;
    } catch (error) {
        console.error('順序の読み込みに失敗:', error);
        return items;
    }
}

function getStorageKeyForContainer(containerSelector) {
    const keyMap = {
        '#wallet-list': 'walletOrder',
        '#budget-list': 'expenseCategoryOrder',
        '#expense-summary-list': 'expenseCategoryOrder',
        '#expense-category': 'expenseCategoryOrder',
        '#credit-summary-list': 'creditSummaryOrder'
    };
    return keyMap[containerSelector] || null;
}

function getItemKey(item, keyProperty) {
    if (keyProperty === 'wallet.id') return item.id;
    if (keyProperty === 'category.id') return item.id;
    if (keyProperty === 'category.name') {
        // 予算確認ページの場合
        if (item.category) return item.category;
        // 予算設定ページの場合
        if (item.name) return item.name;
    }
    return null;
}

// 商品行追加
function addItemRow(itemData = null) {
    const container = document.getElementById('items-container');
    const itemId = Date.now(); // ユニークID生成
    
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    itemRow.setAttribute('data-item-id', itemId);
    
    itemRow.innerHTML = `
        <input type="text" class="item-name" placeholder="商品名" value="${itemData?.name || ''}">
        <input type="number" class="item-amount" placeholder="金額" step="0.01" min="0" value="${itemData?.amount || ''}">
        <select class="item-category">
            <option value="">カテゴリ選択</option>
        </select>
        <button type="button" class="remove-item" onclick="removeItemRow(${itemId})">削除</button>
    `;
    
    // カテゴリ選択肢を追加
    const categorySelect = itemRow.querySelector('.item-category');
    expenseCategories.forEach(category => {
        const option = new Option(category.name, category.id);
        if (itemData?.expense_category_id == category.id) {
            option.selected = true;
        }
        categorySelect.add(option);
    });
    
    container.appendChild(itemRow);
    
    // 最初の商品名入力欄にフォーカス
    if (!itemData) {
        itemRow.querySelector('.item-name').focus();
    }
}

// 商品行削除
function removeItemRow(itemId) {
    const itemRow = document.querySelector(`[data-item-id="${itemId}"]`);
    if (itemRow) {
        itemRow.remove();
    }
}

// 決済場所自動補完設定
function setupPaymentLocationAutocomplete() {
    const input = document.getElementById('payment-location');
    let debounceTimer = null;
    
    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            loadPaymentLocationSuggestions(e.target.value);
        }, 300);
    });
    
    input.addEventListener('focus', () => {
        if (input.value.length === 0) {
            loadPaymentLocationSuggestions('');
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && currentSuggestions && !currentSuggestions.contains(e.target)) {
            hideSuggestions();
        }
    });
}

// 決済場所候補読み込み
async function loadPaymentLocationSuggestions(search) {
    try {
        const response = await fetch(`/api/payment-locations?search=${encodeURIComponent(search)}`);
        const locations = await response.json();
        showSuggestions(locations);
    } catch (error) {
        console.error('決済場所候補の取得に失敗しました:', error);
    }
}

// 候補表示
function showSuggestions(locations) {
    hideSuggestions();
    
    if (locations.length === 0) return;
    
    const input = document.getElementById('payment-location');
    const suggestions = document.createElement('div');
    suggestions.className = 'payment-location-suggestions';
    suggestions.style.top = input.offsetTop + input.offsetHeight + 'px';
    suggestions.style.left = input.offsetLeft + 'px';
    suggestions.style.width = input.offsetWidth + 'px';
    
    locations.forEach(location => {
        const suggestion = document.createElement('div');
        suggestion.className = 'payment-location-suggestion';
        suggestion.textContent = location.name;
        suggestion.addEventListener('click', () => {
            input.value = location.name;
            hideSuggestions();
            input.focus();
        });
        suggestions.appendChild(suggestion);
    });
    
    input.parentElement.style.position = 'relative';
    input.parentElement.appendChild(suggestions);
    currentSuggestions = suggestions;
}

// 候補非表示
function hideSuggestions() {
    if (currentSuggestions) {
        currentSuggestions.remove();
        currentSuggestions = null;
    }
}

// 予算調整モーダル表示
function showBudgetAdjustmentModal() {
    const year = document.getElementById('summary-year').value;
    const month = document.getElementById('summary-month').value;
    
    if (!year || !month) {
        alert('年月を選択してから調整を行ってください');
        return;
    }
    
    loadBudgetAdjustmentData(year, month);
    document.getElementById('budget-adjustment-modal').classList.remove('hidden');
}

// 予算調整モーダル閉じる
function closeBudgetAdjustmentModal() {
    document.getElementById('budget-adjustment-modal').classList.add('hidden');
}

// 予算調整データ読み込み
async function loadBudgetAdjustmentData(year, month) {
    try {
        const response = await fetch(`/api/summary/${year}/${month}`);
        const summary = await response.json();
        
        const adjustmentList = document.getElementById('budget-adjustment-list');
        adjustmentList.innerHTML = '';
        
        summary.expenseSummary.forEach(item => {
            const adjustmentItem = document.createElement('div');
            adjustmentItem.className = 'adjustment-item';
            adjustmentItem.setAttribute('data-category-id', getCategoryIdByName(item.category));
            
            const currentRemaining = item.remaining;
            
            adjustmentItem.innerHTML = `
                <label>${item.category}</label>
                <div class="current-balance">
                    現在の残額: ¥${currentRemaining.toLocaleString()}
                </div>
                <input type="number" class="adjustment-input" 
                       value="${currentRemaining}" 
                       step="1000" 
                       data-original="${currentRemaining}"
                       placeholder="調整後の残額">
                <div class="difference">¥0</div>
            `;
            
            // 調整額の計算イベント
            const input = adjustmentItem.querySelector('.adjustment-input');
            const differenceEl = adjustmentItem.querySelector('.difference');
            
            input.addEventListener('input', () => {
                const newAmount = parseFloat(input.value) || 0;
                const difference = newAmount - currentRemaining;
                
                differenceEl.textContent = (difference >= 0 ? '+' : '') + '¥' + difference.toLocaleString();
                differenceEl.className = 'difference ' + (difference >= 0 ? 'positive' : 'negative');
            });
            
            adjustmentList.appendChild(adjustmentItem);
        });
        
    } catch (error) {
        console.error('予算調整データの読み込みに失敗しました:', error);
        alert('予算調整データの読み込みに失敗しました');
    }
}

// カテゴリ名からIDを取得
function getCategoryIdByName(categoryName) {
    const category = expenseCategories.find(cat => cat.name === categoryName);
    return category ? category.id : null;
}

// 予算調整を保存
async function saveBudgetAdjustments() {
    const year = document.getElementById('summary-year').value;
    const month = document.getElementById('summary-month').value;
    const adjustmentItems = document.querySelectorAll('.adjustment-item');
    
    const adjustments = [];
    
    adjustmentItems.forEach(item => {
        const categoryId = item.getAttribute('data-category-id');
        const input = item.querySelector('.adjustment-input');
        const newAmount = parseFloat(input.value) || 0;
        const currentAmount = parseFloat(input.getAttribute('data-original'));
        
        if (newAmount !== currentAmount && categoryId) {
            adjustments.push({
                category_id: categoryId,
                adjustment_amount: newAmount - currentAmount,
                description: `予算残高手動調整 (${year}年${month}月)`
            });
        }
    });
    
    console.log('調整データ:', adjustments);
    
    if (adjustments.length === 0) {
        alert('調整する項目がありません');
        return;
    }
    
    try {
        const promises = adjustments.map(adjustment => 
            fetch('/api/budget-adjustments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    year: parseInt(year),
                    month: parseInt(month),
                    ...adjustment
                })
            })
        );
        
        await Promise.all(promises);
        
        alert('予算調整を保存しました');
        closeBudgetAdjustmentModal();
        
        // 集計を再読み込み
        console.log('集計を再読み込み中...');
        await loadSummary();
        console.log('集計再読み込み完了');
        
    } catch (error) {
        console.error('予算調整の保存に失敗しました:', error);
        alert('予算調整の保存に失敗しました');
    }
}

// 取引削除
async function deleteTransaction(transactionId) {
    if (!confirm('この取引を削除しますか？\n\n注意: この操作は元に戻せません。')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/transactions/${transactionId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('取引を削除しました');
            
            // カレンダーを更新
            showCalendar();
            
            // 詳細ウィンドウが開いていれば更新
            if (selectedDate) {
                showDayDetail(selectedDate);
            }
            
            // カテゴリデータを再読み込み（残高が更新されているため）
            await loadCategories();
        } else {
            alert('取引の削除に失敗しました: ' + result.error);
        }
    } catch (error) {
        console.error('取引削除エラー:', error);
        alert('取引の削除に失敗しました');
    }
}

// 取引編集
async function editTransaction(transactionId) {
    try {
        // 取引データを取得
        const response = await fetch(`/api/transactions/${transactionId}`);
        const transaction = await response.json();
        
        if (!response.ok) {
            alert('取引データの取得に失敗しました');
            return;
        }
        
        // 入力タブに切り替え
        showView('input');
        
        // フォームに値を設定
        document.getElementById('transaction-date').value = transaction.date;
        document.getElementById('transaction-amount').value = transaction.amount;
        document.getElementById('transaction-type').value = transaction.type;
        document.getElementById('transaction-description').value = transaction.description || '';
        document.getElementById('transaction-memo').value = transaction.memo || '';
        document.getElementById('payment-location').value = transaction.payment_location || '';
        document.getElementById('transaction-notes').value = transaction.notes || '';
        
        // カテゴリ設定
        if (transaction.expense_category_id) {
            document.getElementById('expense-category').value = transaction.expense_category_id;
        }
        
        // 支払い方法設定
        if (transaction.wallet_category_id) {
            document.querySelector('input[name="payment-method"][value="wallet"]').checked = true;
            document.getElementById('wallet-category').value = transaction.wallet_category_id;
        } else if (transaction.credit_category_id) {
            document.querySelector('input[name="payment-method"][value="credit"]').checked = true;
            document.getElementById('credit-category').value = transaction.credit_category_id;
        }
        
        // フィールド表示を更新
        toggleExpenseCategory();
        togglePaymentMethod();
        
        // 編集モードであることを示す
        const form = document.getElementById('transaction-form');
        form.setAttribute('data-editing-id', transactionId);
        
        // 送信ボタンのテキストを変更
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = '更新';
        
        // キャンセルボタンを追加
        let cancelBtn = form.querySelector('.cancel-edit-btn');
        if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn-secondary cancel-edit-btn';
            cancelBtn.textContent = 'キャンセル';
            cancelBtn.addEventListener('click', cancelEdit);
            submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
        }
        
        alert('取引データを入力フォームに読み込みました。編集後「更新」ボタンを押してください。');
        
    } catch (error) {
        console.error('取引編集エラー:', error);
        alert('取引の編集準備に失敗しました');
    }
}

// 編集キャンセル
function cancelEdit() {
    const form = document.getElementById('transaction-form');
    form.removeAttribute('data-editing-id');
    
    // フォームをリセット
    form.reset();
    setDefaultDate();
    
    // 送信ボタンのテキストを元に戻す
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = '登録';
    
    // キャンセルボタンを削除
    const cancelBtn = form.querySelector('.cancel-edit-btn');
    if (cancelBtn) {
        cancelBtn.remove();
    }
    
    // 商品行をクリア
    document.getElementById('items-container').innerHTML = '';
}

// レシート詳細を表示
async function showReceiptDetails(transactionId) {
    try {
        const response = await fetch(`/api/transactions/${transactionId}`);
        const transaction = await response.json();
        
        if (!response.ok || !transaction.items || transaction.items.length === 0) {
            alert('レシート詳細が見つかりません');
            return;
        }
        
        const content = document.getElementById('receipt-details-content');
        const itemsTotal = transaction.items.reduce((sum, item) => sum + item.amount, 0);
        
        content.innerHTML = `
            <div class="receipt-detail-info">
                <h4>${transaction.description || '取引詳細'}</h4>
                <p><strong>日付:</strong> ${transaction.date}</p>
                <p><strong>決済場所:</strong> ${transaction.payment_location || '未設定'}</p>
                <p><strong>支払方法:</strong> ${transaction.wallet_category_name || transaction.credit_category_name || '不明'}</p>
                <p><strong>メモ:</strong> ${transaction.memo || 'なし'}</p>
            </div>
            
            <div class="receipt-items-detail">
                <h5>商品詳細</h5>
                <div class="receipt-items-table">
                    <div class="receipt-items-header">
                        <div>商品名</div>
                        <div>カテゴリ</div>
                        <div>金額</div>
                    </div>
                    ${transaction.items.map(item => `
                        <div class="receipt-items-row">
                            <div class="item-name-cell">${item.item_name}</div>
                            <div class="item-category-cell">${item.expense_category_name || '未分類'}</div>
                            <div class="item-amount-cell">¥${item.amount.toLocaleString()}</div>
                        </div>
                    `).join('')}
                    <div class="receipt-items-total">
                        <div></div>
                        <div><strong>合計</strong></div>
                        <div><strong>¥${itemsTotal.toLocaleString()}</strong></div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('receipt-details-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('レシート詳細表示エラー:', error);
        alert('レシート詳細の表示に失敗しました');
    }
}

// レシート詳細モーダルを閉じる
function closeReceiptDetailsModal() {
    document.getElementById('receipt-details-modal').classList.add('hidden');
}

// 財布残高更新
async function updateWalletBalance(walletId) {
    const input = document.querySelector(`input[data-wallet-id="${walletId}"]`);
    const newBalance = parseFloat(input.value);
    
    try {
        const response = await fetch(`/api/wallets/${walletId}/balance`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ balance: newBalance })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('残高を更新しました');
            await loadWalletBalances();
            await loadCategories(); // セレクトボックスの残高表示も更新
        } else {
            alert('残高の更新に失敗しました: ' + result.error);
        }
    } catch (error) {
        console.error('残高更新エラー:', error);
        alert('残高の更新に失敗しました');
    }
}