import type { TaskPriority, TaskStatus } from "../domain/task";

export interface Subtask {
  id: number;
  title: string;
  done: boolean;
  position: number;
}

export interface Task {
  id: number;
  code: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  customerId: number | null;
  customerCompany: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  dueAt: Date | null;
  estimateHours: number | null;
  trackedHours: number;
  blockedReason: string | null;
  tags: string[];
  commentCount: number;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  subtasks: Subtask[];
}

export interface TaskBoardQuery {
  assigneeId?: number;
  customerId?: number | "internal";
  priority?: TaskPriority;
  /** Only tasks due on or before this instant. */
  dueBefore?: Date;
  /** Exclude completed tasks. */
  openOnly?: boolean;
}

export interface NewTask {
  code: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  customerId?: number | null;
  assigneeId?: number | null;
  dueAt?: Date | null;
  estimateHours?: number | null;
  tags?: string[];
  subtasks?: string[];
}

export interface TaskStatusUpdate {
  status: TaskStatus;
  completedAt: Date | null;
  blockedReason: string | null;
  updatedAt: Date;
}

export interface TaskRepository {
  listBoard(query: TaskBoardQuery): Promise<Task[]>;
  findById(id: number): Promise<Task | null>;
  latestCode(): Promise<string | null>;
  create(task: NewTask, now: Date): Promise<Task>;
  updateStatus(id: number, update: TaskStatusUpdate): Promise<void>;
  /** Returns false when the subtask does not belong to the task. */
  setSubtaskDone(taskId: number, subtaskId: number, done: boolean, now: Date): Promise<boolean>;
  addSubtask(taskId: number, title: string, now: Date): Promise<void>;
  incrementCommentCount(id: number, now: Date): Promise<void>;
}
