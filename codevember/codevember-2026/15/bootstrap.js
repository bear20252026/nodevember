import { createLoadingScreen } from './loading.js';

const loading = createLoadingScreen();
try {
  loading.update(.02, 'Reading the dunes…');
  const { startExperiment } = await import('./main.js');
  await startExperiment(loading);
} catch (error) {
  loading.fail(`Unable to start: ${error.message}`);
  console.error(error);
}
