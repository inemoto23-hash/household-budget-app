const fs = require('fs');
const path = require('path');

// 初期データを投入する関数
async function seedDatabase(db) {
    console.log('完全なデータベース（入力済みデータ含む）を投入中...');
    
    try {
        // データが既に存在するかチェック
        const existingTransactions = await db.get('SELECT COUNT(*) as count FROM transactions');
        if (existingTransactions.count > 0) {
            console.log('データベースには既にデータが存在します。スキップします。');
            return;
        }
        
        // 実際のSQLファイルを使用してデータを投入
        const fs = require('fs');
        const path = require('path');
        const sqlFilePath = path.join(__dirname, 'migration_data.sql');
        
        if (fs.existsSync(sqlFilePath)) {
            console.log('完全なデータセット（migration_data.sql）を読み込み中...');
            const sql = fs.readFileSync(sqlFilePath, 'utf8');
            
            // SQLファイルを実行
            const statements = sql.split(';').filter(s => s.trim());
            for (const statement of statements) {
                if (statement.trim() && !statement.trim().startsWith('--')) {
                    await db.run(statement.trim());
                }
            }
            
            console.log('✅ 完全なデータベース（入力済みデータ含む）の投入が完了しました！');
            console.log('- 出費カテゴリ: 12件（たけ・ささ小遣い分離済み）');
            console.log('- 財布カテゴリ: 12件（家現金含む、最新残高）');
            console.log('- 取引データ: 16件（入力済みデータ）');
            console.log('- 予算設定: 24件（9月・10月分）');
            console.log('- クレジット集計: 3件');
        } else {
            console.log('migration_data.sqlが見つかりません。基本データのみ投入します。');
            await seedBasicData(db);
        }
        
    } catch (error) {
        console.error('完全データ投入エラー:', error);
        console.log('基本データのみ投入を試行します...');
        await seedBasicData(db);
    }
}

// フォールバック用の基本データ投入
async function seedBasicData(db) {
        
        // 初期データの投入
        const seedData = [
            // 出費カテゴリ（たけ小遣い・ささ小遣い分離済み）
            { table: 'expense_categories', data: [
                { id: 1, name: '食費' },
                { id: 2, name: '生活費' },
                { id: 3, name: '養育費' },
                { id: 4, name: 'ローン' },
                { id: 6, name: '娯楽費' },
                { id: 7, name: '車維持費' },
                { id: 8, name: '医療費' },
                { id: 9, name: '公共料金' },
                { id: 10, name: '投資' },
                { id: 11, name: 'その他' },
                { id: 12, name: 'たけ小遣い' },
                { id: 13, name: 'ささ小遣い' }
            ]},
            
            // 財布カテゴリ（家現金含む）
            { table: 'wallet_categories', data: [
                { id: 1, name: '三井住友銀行', balance: 771 },
                { id: 2, name: '埼玉りそな銀行', balance: 122844 },
                { id: 3, name: '楽天銀行', balance: 548089 },
                { id: 4, name: '楽天証券', balance: 415513 },
                { id: 5, name: '住信SBI証券', balance: 4855 },
                { id: 6, name: '現金たけ', balance: 40470 },
                { id: 7, name: '現金ささ', balance: 6607 },
                { id: 8, name: 'Suicaたけ', balance: 4476 },
                { id: 9, name: 'Suicaささ', balance: 7021 },
                { id: 10, name: '楽天Payたけ', balance: 3013 },
                { id: 11, name: '楽天Payささ', balance: 8527 },
                { id: 12, name: '家現金', balance: 221200 }
            ]},
            
            // クレジットカードカテゴリ
            { table: 'credit_categories', data: [
                { id: 1, name: '楽天カード' },
                { id: 2, name: 'Amazon Mastercard' }
            ]},
            
            // 2025年9月の予算設定（たけ・ささ小遣い分離済み）
            { table: 'monthly_budgets', data: [
                { year: 2025, month: 9, expense_category_id: 1, budget_amount: 60000 }, // 食費
                { year: 2025, month: 9, expense_category_id: 2, budget_amount: 30000 }, // 生活費
                { year: 2025, month: 9, expense_category_id: 3, budget_amount: 80000 }, // 養育費
                { year: 2025, month: 9, expense_category_id: 4, budget_amount: 120000 }, // ローン
                { year: 2025, month: 9, expense_category_id: 6, budget_amount: 20000 }, // 娯楽費
                { year: 2025, month: 9, expense_category_id: 7, budget_amount: 15000 }, // 車維持費
                { year: 2025, month: 9, expense_category_id: 8, budget_amount: 10000 }, // 医療費
                { year: 2025, month: 9, expense_category_id: 9, budget_amount: 25000 }, // 公共料金
                { year: 2025, month: 9, expense_category_id: 10, budget_amount: 50000 }, // 投資
                { year: 2025, month: 9, expense_category_id: 11, budget_amount: 10000 }, // その他
                { year: 2025, month: 9, expense_category_id: 12, budget_amount: 35000 }, // たけ小遣い
                { year: 2025, month: 9, expense_category_id: 13, budget_amount: 35000 }  // ささ小遣い
            ]}
        ];
        
        // データを挿入
        for (const { table, data } of seedData) {
            for (const row of data) {
                const columns = Object.keys(row).join(', ');
                const placeholders = Object.keys(row).map(() => '?').join(', ');
                const values = Object.values(row);
                
                await db.run(
                    `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
                    values
                );
            }
            console.log(`${table} に ${data.length} 件のデータを投入しました`);
        }
        
        console.log('✅ 初期データの投入が完了しました！');
        
    } catch (error) {
        console.error('初期データ投入エラー:', error);
        throw error;
    }
}

module.exports = { seedDatabase };