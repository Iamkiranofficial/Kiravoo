export type RenderJob = {
  id: string;
  prompt: string;
  status: "queued" | "processing" | "complete" | "failed";
  url?: string;
  error?: string;
  createdAt: string;
  model?: string;
  duration?: number;
  aspectRatio?: string;
  provider?: string;
};

const STORAGE_KEY = "kiravo-render-jobs";
const UPDATE_EVENT = "kiravo-render-jobs-updated";

function readJobs(): RenderJob[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function publish(jobs: RenderJob[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, 100)));
  window.dispatchEvent(new Event(UPDATE_EVENT));
}

export function saveRenderJob(job: RenderJob) {
  const jobs = readJobs();
  publish([job, ...jobs.filter((item) => item.id !== job.id)]);
}

export function updateRenderJob(id: string, changes: Partial<RenderJob>) {
  const jobs = readJobs();
  publish(jobs.map((job) => job.id === id ? { ...job, ...changes } : job));
}

export function renderJobsUpdatedEvent() {
  return UPDATE_EVENT;
}
