// Imported FIRST by index.js. ES modules run in import order, so the schema exists
// before any route module prepares its SQL statements.
import { migrate } from './migrate.js';
migrate();
