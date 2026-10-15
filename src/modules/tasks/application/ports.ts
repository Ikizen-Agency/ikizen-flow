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
  /** Case-insensitive text match on title, code or description. */
  q?: string;
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

/** Editable task fields (status fields come from `applyTaskStatusChange`). */
export interface TaskChanges {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  customerId?: number | null;
  assigneeId?: number | null;
  dueAt?: Date | null;
  estimateHours?: number | null;
  tags?: string[];
  blockedReason?: string | null;
  completedAt?: Date | null;
  updatedAt: Date;
}

export interface TaskRepository {
  listBoard(query: TaskBoardQuery): Promise<Task[]>;
  findById(id: number): Promise<Task | null>;
  latestCode(): Promise<string | null>;
  create(task: NewTask, now: Date): Promise<Task>;
  updateStatus(id: number, update: TaskStatusUpdate): Promise<void>;
  /** Validates that a new customer / assignee belongs to the workspace. */
  update(id: number, changes: TaskChanges): Promise<void>;
  /** Returns false when the task does not exist in the workspace. */
  delete(id: number): Promise<boolean>;
  /** Returns false when the subtask does not belong to the task. */
  setSubtaskDone(taskId: number, subtaskId: number, done: boolean, now: Date): Promise<boolean>;
  addSubtask(taskId: number, title: string, now: Date): Promise<void>;
  /** Both return false when the subtask does not belong to the task (or the task to the workspace). */
  renameSubtask(taskId: number, subtaskId: number, title: string, now: Date): Promise<boolean>;
  deleteSubtask(taskId: number, subtaskId: number, now: Date): Promise<boolean>;
}

export interface TaskComment {
  id: number;
  taskId: number;
  authorId: number | null;
  authorName: string | null;
  /** Stored body with inline `@[Name](memberId)` mentions. */
  body: string;
  createdAt: Date;
  editedAt: Date | null;
}

/** Comments of tasks in one workspace (ids of other workspaces behave as missing). */
export interface TaskCommentRepository {
  listForTask(taskId: number): Promise<TaskComment[]>;
  findById(id: number): Promise<TaskComment | null>;
  /** Throws NotFoundError when the task is not in the workspace. */
  create(comment: { taskId: number; authorId: number | null; body: string }, now: Date): Promise<TaskComment>;
  update(id: number, body: string, now: Date): Promise<void>;
  delete(id: number): Promise<void>;
}
