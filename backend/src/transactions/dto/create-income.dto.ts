import { CreateExpenseDto } from './create-expense.dto';

/**
 * Money received: same fields as an expense. It starts NEEDS_REVIEW and counts toward the
 * balance only after the branch head confirms it. A treasurer files it on the web form and
 * attaches the evidence (a deposit slip, a transfer receipt ...).
 */
export class CreateIncomeDto extends CreateExpenseDto {}
