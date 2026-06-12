import type { Variable, SimulationResult, Percentiles, Histogram, HistogramBin, SensitivityItem } from './types';
import { v4 as uuidv4 } from 'uuid';

export function sampleTriangular(min: number, mostLikely: number, max: number): number {
  if (min > max) [min, max] = [max, min];
  if (mostLikely < min) mostLikely = min;
  if (mostLikely > max) mostLikely = max;

  const u = Math.random();
  const range = max - min;

  if (range === 0) return min;

  const modePos = (mostLikely - min) / range;
  let result: number;

  if (u < modePos) {
    result = min + Math.sqrt(u * range * (mostLikely - min));
  } else {
    result = max - Math.sqrt((1 - u) * range * (max - mostLikely));
  }

  return result;
}

export function calcMean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function calcMedian(sortedArr: number[]): number {
  if (sortedArr.length === 0) return 0;
  const mid = Math.floor(sortedArr.length / 2);
  if (sortedArr.length % 2 === 0) {
    return (sortedArr[mid - 1] + sortedArr[mid]) / 2;
  }
  return sortedArr[mid];
}

export function calcStdDev(arr: number[], mean: number): number {
  if (arr.length === 0) return 0;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

export function calcPercentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const idx = (p / 100) * (sortedArr.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedArr[lo];
  const frac = idx - lo;
  return sortedArr[lo] * (1 - frac) + sortedArr[hi] * frac;
}

export function calcPercentiles(sortedArr: number[]): Percentiles {
  return {
    p5: calcPercentile(sortedArr, 5),
    p25: calcPercentile(sortedArr, 25),
    p50: calcPercentile(sortedArr, 50),
    p75: calcPercentile(sortedArr, 75),
    p95: calcPercentile(sortedArr, 95),
  };
}

export function calcLossProbability(arr: number[], threshold: number): number {
  if (arr.length === 0) return 0;
  const losses = arr.filter(v => v < threshold).length;
  return losses / arr.length;
}

export function buildHistogram(arr: number[], numBins?: number): Histogram {
  if (arr.length === 0) return { bins: [] };

  const min = Math.min(...arr);
  const max = Math.max(...arr);

  if (!numBins) {
    numBins = Math.ceil(Math.log2(arr.length)) + 1;
  }

  const range = max - min || 1;
  const binWidth = range / numBins;

  const bins: HistogramBin[] = [];
  for (let i = 0; i < numBins; i++) {
    bins.push({
      start: min + i * binWidth,
      end: min + (i + 1) * binWidth,
      count: 0,
    });
  }

  for (const v of arr) {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= numBins) idx = numBins - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  }

  return { bins };
}

export function calcPearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;

  const meanX = calcMean(x);
  const meanY = calcMean(y);

  let num = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  if (denomX === 0 || denomY === 0) return 0;
  return num / Math.sqrt(denomX * denomY);
}

export function calcSensitivity(
  variables: Variable[],
  variableSamples: Record<string, number[]>,
  results: number[]
): SensitivityItem[] {
  const correlations: SensitivityItem[] = variables.map(v => {
    const samples = variableSamples[v.id] || [];
    const corr = calcPearsonCorrelation(samples, results);
    return {
      variableId: v.id,
      variableName: v.name,
      correlation: corr,
      contribution: 0,
    };
  });

  const totalAbs = correlations.reduce((s, c) => s + Math.abs(c.correlation), 0);
  if (totalAbs > 0) {
    correlations.forEach(c => {
      c.contribution = (Math.abs(c.correlation) / totalAbs) * 100;
    });
  }

  correlations.sort((a, b) => b.contribution - a.contribution);
  return correlations;
}

export interface SimulateOptions {
  iterations: number;
  threshold: number;
  runName?: string;
}

export function runMonteCarloSimulation(
  projectId: string,
  variables: Variable[],
  options: SimulateOptions
): SimulationResult {
  const { iterations, threshold, runName } = options;

  const variableSamples: Record<string, number[]> = {};
  variables.forEach(v => {
    variableSamples[v.id] = new Array(iterations);
  });

  const results = new Array(iterations);

  for (let i = 0; i < iterations; i++) {
    let iterResult = 0;
    for (const v of variables) {
      const sample = sampleTriangular(v.min, v.mostLikely, v.max);
      variableSamples[v.id][i] = sample;
      iterResult += sample * v.weight;
    }
    results[i] = iterResult;
  }

  const sortedResults = [...results].sort((a, b) => a - b);
  const mean = calcMean(results);
  const median = calcMedian(sortedResults);
  const stdDev = calcStdDev(results, mean);
  const percentiles = calcPercentiles(sortedResults);
  const lossProb = calcLossProbability(results, threshold);
  const var95 = percentiles.p5;
  const histogram = buildHistogram(results);
  const sensitivity = calcSensitivity(variables, variableSamples, results);

  return {
    id: uuidv4(),
    projectId,
    runName: runName || `运行 ${new Date().toLocaleString('zh-CN')}`,
    iterations,
    timestamp: new Date().toISOString(),
    mean,
    median,
    stdDev,
    min: sortedResults[0],
    max: sortedResults[sortedResults.length - 1],
    percentiles,
    lossProbability: lossProb,
    var95,
    threshold,
    histogram,
    sensitivity,
    samples: results,
    variableSamples,
  };
}

export function formatNumber(num: number, decimals = 2): string {
  if (!isFinite(num)) return 'N/A';
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercentage(num: number, decimals = 2): string {
  if (!isFinite(num)) return 'N/A';
  return (num * 100).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + '%';
}
