const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all budgets for current period
const getBudgets = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { year, period, month } = req.query;
    
    const currentYear = year || new Date().getFullYear();
    const currentMonth = month || new Date().getMonth() + 1;

    const budgets = await prisma.budget.findMany({
      where: {
        schoolId,
        year: parseInt(currentYear),
        ...(period && { period }),
        ...(period === 'monthly' && { month: parseInt(currentMonth) })
      },
      orderBy: { category: 'asc' }
    });

    // Calculate actual spending for each budget category
    const budgetsWithSpending = await Promise.all(
      budgets.map(async (budget) => {
        let startDate, endDate;
        
        if (budget.period === 'monthly') {
          startDate = new Date(budget.year, budget.month - 1, 1);
          endDate = new Date(budget.year, budget.month, 0);
        } else if (budget.period === 'yearly') {
          startDate = new Date(budget.year, 0, 1);
          endDate = new Date(budget.year, 11, 31);
        } else {
          // Termly - approximate 4 months per term
          const termStart = budget.termId ? 0 : 0; // Would need term dates
          startDate = new Date(budget.year, 0, 1);
          endDate = new Date(budget.year, 11, 31);
        }

        const expenses = await prisma.expense.aggregate({
          where: {
            schoolId,
            category: { name: budget.category },
            date: {
              gte: startDate,
              lte: endDate
            },
            isVoided: false
          },
          _sum: { amount: true }
        });

        const spent = expenses._sum.amount || 0;
        const budgetAmount = parseFloat(budget.amount);
        const percentage = budgetAmount > 0 ? (parseFloat(spent) / budgetAmount) * 100 : 0;

        return {
          ...budget,
          amount: parseFloat(budget.amount),
          spent: parseFloat(spent),
          remaining: budgetAmount - parseFloat(spent),
          percentage: Math.round(percentage * 10) / 10,
          status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok'
        };
      })
    );

    res.json({ success: true, data: budgetsWithSpending });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create or update budget
const upsertBudget = async (req, res) => {
  try {
    const { schoolId, id: userId } = req.user;
    const { category, amount, period, month, year } = req.body;

    if (!category || !amount || !period || !year) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category, amount, period, and year are required' 
      });
    }

    const budget = await prisma.budget.upsert({
      where: {
        schoolId_category_period_year_month: {
          schoolId,
          category,
          period,
          year: parseInt(year),
          month: period === 'monthly' ? parseInt(month) : null
        }
      },
      update: {
        amount: parseFloat(amount),
        updatedAt: new Date()
      },
      create: {
        schoolId,
        category,
        amount: parseFloat(amount),
        period,
        year: parseInt(year),
        month: period === 'monthly' ? parseInt(month) : null,
        createdBy: userId
      }
    });

    res.json({ success: true, data: budget });
  } catch (error) {
    console.error('Upsert budget error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Bulk set budgets for all categories
const setBulkBudgets = async (req, res) => {
  try {
    const { schoolId, id: userId } = req.user;
    const { budgets, period, year, month } = req.body;

    if (!budgets || !Array.isArray(budgets)) {
      return res.status(400).json({ success: false, message: 'Budgets array required' });
    }

    const results = await Promise.all(
      budgets.map(async ({ category, amount }) => {
        if (!amount || amount <= 0) return null;
        
        return prisma.budget.upsert({
          where: {
            schoolId_category_period_year_month: {
              schoolId,
              category,
              period,
              year: parseInt(year),
              month: period === 'monthly' ? parseInt(month) : null
            }
          },
          update: { amount: parseFloat(amount) },
          create: {
            schoolId,
            category,
            amount: parseFloat(amount),
            period,
            year: parseInt(year),
            month: period === 'monthly' ? parseInt(month) : null,
            createdBy: userId
          }
        });
      })
    );

    res.json({ 
      success: true, 
      message: `${results.filter(r => r).length} budgets saved`,
      data: results.filter(r => r)
    });
  } catch (error) {
    console.error('Bulk budget error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete budget
const deleteBudget = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    await prisma.budget.deleteMany({
      where: { id, schoolId }
    });

    res.json({ success: true, message: 'Budget deleted' });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get budget summary/overview
const getBudgetSummary = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    // Get all budgets for the period
    const budgets = await prisma.budget.findMany({
      where: {
        schoolId,
        year,
        OR: [
          { period: 'yearly' },
          { period: 'monthly', month }
        ]
      }
    });

    const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(b.amount), 0);

    // Get actual spending for this month
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    const expenses = await prisma.expense.aggregate({
      where: {
        schoolId,
        date: { gte: startOfMonth, lte: endOfMonth },
        isVoided: false
      },
      _sum: { amount: true }
    });

    const totalSpent = parseFloat(expenses._sum.amount || 0);
    const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    // Categories over budget
    const overBudget = [];
    for (const budget of budgets) {
      const catExpenses = await prisma.expense.aggregate({
        where: {
          schoolId,
          category: { name: budget.category },
          date: { gte: startOfMonth, lte: endOfMonth },
          isVoided: false
        },
        _sum: { amount: true }
      });
      
      const spent = parseFloat(catExpenses._sum.amount || 0);
      if (spent > parseFloat(budget.amount)) {
        overBudget.push({
          category: budget.category,
          budget: parseFloat(budget.amount),
          spent,
          over: spent - parseFloat(budget.amount)
        });
      }
    }

    res.json({
      success: true,
      data: {
        totalBudget,
        totalSpent,
        remaining: totalBudget - totalSpent,
        percentage: Math.round(percentage * 10) / 10,
        overBudgetCount: overBudget.length,
        overBudgetCategories: overBudget,
        status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok'
      }
    });
  } catch (error) {
    console.error('Budget summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getBudgets,
  upsertBudget,
  setBulkBudgets,
  deleteBudget,
  getBudgetSummary
};