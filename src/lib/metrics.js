/**
 * Minimal in-process metrics registry (Prometheus text format).
 *
 * Per-instance, like most Node metrics without an external agent. Scrape
 * `/api/metrics` (protected by METRICS_TOKEN) from a Prometheus-compatible
 * collector, or read them manually during an incident.
 */
const counters = new Map();
const histograms = new Map();

const DEFAULT_BUCKETS_MS = [5, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

function labelKey(labels = {}) {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
}

function escapeLabelValue(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

function formatLabels(labels = {}) {
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "";
  return `{${entries
    .map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
    .join(",")}}`;
}

export function incrementCounter(name, labels = {}, value = 1) {
  const key = `${name}|${labelKey(labels)}`;
  const current = counters.get(key) || { name, labels, value: 0 };
  current.value += value;
  counters.set(key, current);
}

export function observeHistogram(name, value, labels = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return;

  const key = `${name}|${labelKey(labels)}`;
  let histogram = histograms.get(key);
  if (!histogram) {
    histogram = {
      name,
      labels,
      bucketCounts: new Array(DEFAULT_BUCKETS_MS.length).fill(0),
      sum: 0,
      count: 0,
    };
    histograms.set(key, histogram);
  }

  histogram.count += 1;
  histogram.sum += numeric;
  for (let index = 0; index < DEFAULT_BUCKETS_MS.length; index += 1) {
    if (numeric <= DEFAULT_BUCKETS_MS[index]) histogram.bucketCounts[index] += 1;
  }
}

export function renderPrometheus() {
  const lines = [];

  for (const counter of counters.values()) {
    lines.push(`# TYPE ${counter.name} counter`);
    lines.push(`${counter.name}${formatLabels(counter.labels)} ${counter.value}`);
  }

  for (const histogram of histograms.values()) {
    lines.push(`# TYPE ${histogram.name} histogram`);
    for (let index = 0; index < DEFAULT_BUCKETS_MS.length; index += 1) {
      lines.push(
        `${histogram.name}_bucket${formatLabels({
          ...histogram.labels,
          le: DEFAULT_BUCKETS_MS[index],
        })} ${histogram.bucketCounts[index]}`
      );
    }
    lines.push(
      `${histogram.name}_bucket${formatLabels({ ...histogram.labels, le: "+Inf" })} ${histogram.count}`
    );
    lines.push(`${histogram.name}_sum${formatLabels(histogram.labels)} ${histogram.sum}`);
    lines.push(`${histogram.name}_count${formatLabels(histogram.labels)} ${histogram.count}`);
  }

  return `${lines.join("\n")}\n`;
}

export function resetMetrics() {
  counters.clear();
  histograms.clear();
}
