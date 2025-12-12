package warehouse

import (
	"context"
	"errors"
	"sort"
	"time"
)

// Task errors
var (
	ErrTaskNotFound     = errors.New("task not found")
	ErrTaskAlreadyTaken = errors.New("task already assigned")
	ErrInvalidTaskState = errors.New("invalid task state")
)

// TaskType represents type of warehouse task
type TaskType string

const (
	TaskTypePicking    TaskType = "picking"
	TaskTypePutaway    TaskType = "putaway"
	TaskTypeReplenish  TaskType = "replenish"
	TaskTypeCycleCount TaskType = "cycle_count"
	TaskTypeTransfer   TaskType = "transfer"
	TaskTypeQC         TaskType = "quality_check"
	TaskTypePacking    TaskType = "packing"
	TaskTypeLoading    TaskType = "loading"
	TaskTypeUnloading  TaskType = "unloading"
	TaskTypeCleanup    TaskType = "cleanup"
	TaskTypeInventory  TaskType = "inventory"
)

// TaskPriority represents task priority
type TaskPriority int

const (
	PriorityUrgent   TaskPriority = 1
	PriorityHigh     TaskPriority = 2
	PriorityNormal   TaskPriority = 3
	PriorityLow      TaskPriority = 4
)

// TaskStatus represents task status
type TaskStatus string

const (
	TaskStatusPending    TaskStatus = "pending"
	TaskStatusAssigned   TaskStatus = "assigned"
	TaskStatusInProgress TaskStatus = "in_progress"
	TaskStatusPaused     TaskStatus = "paused"
	TaskStatusCompleted  TaskStatus = "completed"
	TaskStatusCancelled  TaskStatus = "cancelled"
	TaskStatusFailed     TaskStatus = "failed"
)

// Task represents a warehouse task
type Task struct {
	ID             string       `json:"id"`
	Type           TaskType     `json:"type"`
	Status         TaskStatus   `json:"status"`
	Priority       TaskPriority `json:"priority"`
	WarehouseID    string       `json:"warehouse_id"`
	ZoneID         string       `json:"zone_id,omitempty"`
	AssignedTo     string       `json:"assigned_to,omitempty"`
	AssignedName   string       `json:"assigned_name,omitempty"`
	DocumentType   string       `json:"document_type,omitempty"` // order, transfer, etc.
	DocumentID     string       `json:"document_id,omitempty"`
	Items          []TaskItem   `json:"items"`
	Instructions   string       `json:"instructions,omitempty"`
	EstimatedTime  int          `json:"estimated_time_minutes,omitempty"`
	ActualTime     int          `json:"actual_time_minutes,omitempty"`
	DueDate        *time.Time   `json:"due_date,omitempty"`
	StartedAt      *time.Time   `json:"started_at,omitempty"`
	CompletedAt    *time.Time   `json:"completed_at,omitempty"`
	PausedAt       *time.Time   `json:"paused_at,omitempty"`
	Notes          string       `json:"notes,omitempty"`
	CreatedBy      string       `json:"created_by"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
}

// TaskItem represents item in task
type TaskItem struct {
	ID             string `json:"id"`
	ProductID      string `json:"product_id"`
	SKU            string `json:"sku"`
	Name           string `json:"name"`
	Quantity       int    `json:"quantity"`
	CompletedQty   int    `json:"completed_qty"`
	FromLocation   string `json:"from_location,omitempty"`
	ToLocation     string `json:"to_location,omitempty"`
	BatchNumber    string `json:"batch_number,omitempty"`
	SerialNumber   string `json:"serial_number,omitempty"`
	Status         string `json:"status"` // pending, completed, skipped
	Notes          string `json:"notes,omitempty"`
}

// Worker represents warehouse worker
type Worker struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	Name         string    `json:"name"`
	WarehouseID  string    `json:"warehouse_id"`
	Role         string    `json:"role"` // picker, packer, receiver, etc.
	Skills       []string  `json:"skills,omitempty"`
	Zones        []string  `json:"zones,omitempty"` // Assigned zones
	Equipment    string    `json:"equipment,omitempty"` // scanner, forklift, etc.
	Status       string    `json:"status"` // available, busy, break, offline
	CurrentTask  string    `json:"current_task,omitempty"`
	ShiftStart   time.Time `json:"shift_start"`
	ShiftEnd     time.Time `json:"shift_end"`
	LastActive   time.Time `json:"last_active"`
	CreatedAt    time.Time `json:"created_at"`
}

// WorkerStats represents worker productivity stats
type WorkerStats struct {
	WorkerID        string  `json:"worker_id"`
	WorkerName      string  `json:"worker_name"`
	TasksCompleted  int     `json:"tasks_completed"`
	ItemsPicked     int     `json:"items_picked"`
	ItemsPacked     int     `json:"items_packed"`
	ItemsPutaway    int     `json:"items_putaway"`
	AvgTaskTime     float64 `json:"avg_task_time_minutes"`
	Accuracy        float64 `json:"accuracy_percent"`
	ProductivityScore float64 `json:"productivity_score"`
}

// TaskQueue represents prioritized task queue
type TaskQueue struct {
	WarehouseID string  `json:"warehouse_id"`
	Tasks       []*Task `json:"tasks"`
	TotalTasks  int     `json:"total_tasks"`
	UrgentCount int     `json:"urgent_count"`
	OverdueCount int    `json:"overdue_count"`
}

// TaskRepository defines task data access
type TaskRepository interface {
	// Tasks
	CreateTask(ctx context.Context, task *Task) error
	UpdateTask(ctx context.Context, task *Task) error
	GetTask(ctx context.Context, id string) (*Task, error)
	ListTasks(ctx context.Context, warehouseID string, status TaskStatus, taskType TaskType, limit, offset int) ([]*Task, error)
	GetTasksByDocument(ctx context.Context, documentType, documentID string) ([]*Task, error)
	GetTasksByWorker(ctx context.Context, workerID string, status TaskStatus) ([]*Task, error)
	GetNextTask(ctx context.Context, warehouseID, workerID string, taskTypes []TaskType) (*Task, error)
	GetTaskQueue(ctx context.Context, warehouseID string) (*TaskQueue, error)

	// Workers
	CreateWorker(ctx context.Context, worker *Worker) error
	UpdateWorker(ctx context.Context, worker *Worker) error
	GetWorker(ctx context.Context, id string) (*Worker, error)
	GetWorkerByUserID(ctx context.Context, userID string) (*Worker, error)
	ListWorkers(ctx context.Context, warehouseID string, status string) ([]*Worker, error)
	GetWorkerStats(ctx context.Context, workerID string, from, to time.Time) (*WorkerStats, error)
	GetWarehouseWorkerStats(ctx context.Context, warehouseID string, from, to time.Time) ([]*WorkerStats, error)
}

// TaskService manages warehouse tasks
type TaskService struct {
	repo TaskRepository
}

// NewTaskService creates task service
func NewTaskService(repo TaskRepository) *TaskService {
	return &TaskService{repo: repo}
}

// CreateTask creates new task
func (s *TaskService) CreateTask(ctx context.Context, task *Task) error {
	task.ID = generateID()
	task.Status = TaskStatusPending
	task.CreatedAt = time.Now()
	task.UpdatedAt = time.Now()

	// Assign IDs to items
	for i := range task.Items {
		task.Items[i].ID = generateID()
		task.Items[i].Status = "pending"
	}

	// Estimate time based on items
	if task.EstimatedTime == 0 {
		task.EstimatedTime = len(task.Items) * 2 // 2 minutes per item
	}

	return s.repo.CreateTask(ctx, task)
}

// CreatePickingTask creates picking task from order
func (s *TaskService) CreatePickingTask(ctx context.Context, warehouseID, orderID, createdBy string, items []TaskItem, priority TaskPriority, dueDate *time.Time) (*Task, error) {
	task := &Task{
		Type:         TaskTypePicking,
		Priority:     priority,
		WarehouseID:  warehouseID,
		DocumentType: "order",
		DocumentID:   orderID,
		Items:        items,
		DueDate:      dueDate,
		CreatedBy:    createdBy,
	}

	if err := s.CreateTask(ctx, task); err != nil {
		return nil, err
	}

	return task, nil
}

// CreatePutawayTask creates putaway task
func (s *TaskService) CreatePutawayTask(ctx context.Context, warehouseID, receiptID, createdBy string, items []TaskItem) (*Task, error) {
	task := &Task{
		Type:         TaskTypePutaway,
		Priority:     PriorityNormal,
		WarehouseID:  warehouseID,
		DocumentType: "receipt",
		DocumentID:   receiptID,
		Items:        items,
		CreatedBy:    createdBy,
	}

	if err := s.CreateTask(ctx, task); err != nil {
		return nil, err
	}

	return task, nil
}

// CreateReplenishmentTask creates replenishment task
func (s *TaskService) CreateReplenishmentTask(ctx context.Context, warehouseID, createdBy string, items []TaskItem) (*Task, error) {
	task := &Task{
		Type:         TaskTypeReplenish,
		Priority:     PriorityHigh,
		WarehouseID:  warehouseID,
		Items:        items,
		Instructions: "Replenish pick locations from reserve stock",
		CreatedBy:    createdBy,
	}

	if err := s.CreateTask(ctx, task); err != nil {
		return nil, err
	}

	return task, nil
}

// CreateCycleCountTask creates cycle count task
func (s *TaskService) CreateCycleCountTask(ctx context.Context, warehouseID, zoneID, createdBy string, locations []string) (*Task, error) {
	items := make([]TaskItem, len(locations))
	for i, loc := range locations {
		items[i] = TaskItem{
			FromLocation: loc,
			Status:       "pending",
		}
	}

	task := &Task{
		Type:         TaskTypeCycleCount,
		Priority:     PriorityNormal,
		WarehouseID:  warehouseID,
		ZoneID:       zoneID,
		Items:        items,
		Instructions: "Count inventory at specified locations",
		CreatedBy:    createdBy,
	}

	if err := s.CreateTask(ctx, task); err != nil {
		return nil, err
	}

	return task, nil
}

// AssignTask assigns task to worker
func (s *TaskService) AssignTask(ctx context.Context, taskID, workerID string) error {
	task, err := s.repo.GetTask(ctx, taskID)
	if err != nil {
		return err
	}

	if task.Status != TaskStatusPending {
		return ErrInvalidTaskState
	}

	worker, err := s.repo.GetWorker(ctx, workerID)
	if err != nil {
		return err
	}

	if worker.Status != "available" {
		return ErrTaskAlreadyTaken
	}

	task.Status = TaskStatusAssigned
	task.AssignedTo = workerID
	task.AssignedName = worker.Name
	task.UpdatedAt = time.Now()

	if err := s.repo.UpdateTask(ctx, task); err != nil {
		return err
	}

	// Update worker status
	worker.Status = "busy"
	worker.CurrentTask = taskID
	worker.LastActive = time.Now()

	return s.repo.UpdateWorker(ctx, worker)
}

// StartTask starts task execution
func (s *TaskService) StartTask(ctx context.Context, taskID string) error {
	task, err := s.repo.GetTask(ctx, taskID)
	if err != nil {
		return err
	}

	if task.Status != TaskStatusAssigned && task.Status != TaskStatusPaused {
		return ErrInvalidTaskState
	}

	now := time.Now()
	task.Status = TaskStatusInProgress
	task.StartedAt = &now
	task.UpdatedAt = now

	return s.repo.UpdateTask(ctx, task)
}

// PauseTask pauses task
func (s *TaskService) PauseTask(ctx context.Context, taskID, reason string) error {
	task, err := s.repo.GetTask(ctx, taskID)
	if err != nil {
		return err
	}

	if task.Status != TaskStatusInProgress {
		return ErrInvalidTaskState
	}

	now := time.Now()
	task.Status = TaskStatusPaused
	task.PausedAt = &now
	task.Notes = reason
	task.UpdatedAt = now

	return s.repo.UpdateTask(ctx, task)
}

// CompleteTaskItem marks task item as completed
func (s *TaskService) CompleteTaskItem(ctx context.Context, taskID, itemID string, completedQty int, notes string) error {
	task, err := s.repo.GetTask(ctx, taskID)
	if err != nil {
		return err
	}

	if task.Status != TaskStatusInProgress {
		return ErrInvalidTaskState
	}

	found := false
	for i := range task.Items {
		if task.Items[i].ID == itemID {
			task.Items[i].CompletedQty = completedQty
			task.Items[i].Status = "completed"
			task.Items[i].Notes = notes
			found = true
			break
		}
	}

	if !found {
		return errors.New("item not found")
	}

	task.UpdatedAt = time.Now()
	return s.repo.UpdateTask(ctx, task)
}

// SkipTaskItem skips task item
func (s *TaskService) SkipTaskItem(ctx context.Context, taskID, itemID, reason string) error {
	task, err := s.repo.GetTask(ctx, taskID)
	if err != nil {
		return err
	}

	for i := range task.Items {
		if task.Items[i].ID == itemID {
			task.Items[i].Status = "skipped"
			task.Items[i].Notes = reason
			break
		}
	}

	task.UpdatedAt = time.Now()
	return s.repo.UpdateTask(ctx, task)
}

// CompleteTask completes task
func (s *TaskService) CompleteTask(ctx context.Context, taskID string) error {
	task, err := s.repo.GetTask(ctx, taskID)
	if err != nil {
		return err
	}

	if task.Status != TaskStatusInProgress {
		return ErrInvalidTaskState
	}

	now := time.Now()
	task.Status = TaskStatusCompleted
	task.CompletedAt = &now
	task.UpdatedAt = now

	// Calculate actual time
	if task.StartedAt != nil {
		task.ActualTime = int(now.Sub(*task.StartedAt).Minutes())
	}

	if err := s.repo.UpdateTask(ctx, task); err != nil {
		return err
	}

	// Release worker
	if task.AssignedTo != "" {
		worker, err := s.repo.GetWorker(ctx, task.AssignedTo)
		if err == nil {
			worker.Status = "available"
			worker.CurrentTask = ""
			worker.LastActive = now
			s.repo.UpdateWorker(ctx, worker)
		}
	}

	return nil
}

// CancelTask cancels task
func (s *TaskService) CancelTask(ctx context.Context, taskID, reason string) error {
	task, err := s.repo.GetTask(ctx, taskID)
	if err != nil {
		return err
	}

	if task.Status == TaskStatusCompleted {
		return ErrInvalidTaskState
	}

	task.Status = TaskStatusCancelled
	task.Notes = reason
	task.UpdatedAt = time.Now()

	if err := s.repo.UpdateTask(ctx, task); err != nil {
		return err
	}

	// Release worker
	if task.AssignedTo != "" {
		worker, err := s.repo.GetWorker(ctx, task.AssignedTo)
		if err == nil && worker.CurrentTask == taskID {
			worker.Status = "available"
			worker.CurrentTask = ""
			s.repo.UpdateWorker(ctx, worker)
		}
	}

	return nil
}

// GetTask returns task by ID
func (s *TaskService) GetTask(ctx context.Context, id string) (*Task, error) {
	return s.repo.GetTask(ctx, id)
}

// ListTasks returns list of tasks
func (s *TaskService) ListTasks(ctx context.Context, warehouseID string, status TaskStatus, taskType TaskType, limit, offset int) ([]*Task, error) {
	return s.repo.ListTasks(ctx, warehouseID, status, taskType, limit, offset)
}

// GetTaskQueue returns prioritized task queue
func (s *TaskService) GetTaskQueue(ctx context.Context, warehouseID string) (*TaskQueue, error) {
	return s.repo.GetTaskQueue(ctx, warehouseID)
}

// GetNextTaskForWorker returns next task for worker
func (s *TaskService) GetNextTaskForWorker(ctx context.Context, warehouseID, workerID string, preferredTypes []TaskType) (*Task, error) {
	worker, err := s.repo.GetWorker(ctx, workerID)
	if err != nil {
		return nil, err
	}

	if worker.Status != "available" {
		return nil, errors.New("worker is not available")
	}

	// Get worker's skills/types
	taskTypes := preferredTypes
	if len(taskTypes) == 0 {
		// Default task types based on role
		switch worker.Role {
		case "picker":
			taskTypes = []TaskType{TaskTypePicking, TaskTypeReplenish}
		case "packer":
			taskTypes = []TaskType{TaskTypePacking}
		case "receiver":
			taskTypes = []TaskType{TaskTypePutaway, TaskTypeUnloading}
		default:
			taskTypes = []TaskType{TaskTypePicking, TaskTypePutaway, TaskTypePacking}
		}
	}

	return s.repo.GetNextTask(ctx, warehouseID, workerID, taskTypes)
}

// CreateWorker creates new worker
func (s *TaskService) CreateWorker(ctx context.Context, worker *Worker) error {
	worker.ID = generateID()
	worker.Status = "offline"
	worker.CreatedAt = time.Now()
	worker.LastActive = time.Now()
	return s.repo.CreateWorker(ctx, worker)
}

// ClockIn clocks worker in
func (s *TaskService) ClockIn(ctx context.Context, workerID string) error {
	worker, err := s.repo.GetWorker(ctx, workerID)
	if err != nil {
		return err
	}

	now := time.Now()
	worker.Status = "available"
	worker.ShiftStart = now
	worker.LastActive = now

	return s.repo.UpdateWorker(ctx, worker)
}

// ClockOut clocks worker out
func (s *TaskService) ClockOut(ctx context.Context, workerID string) error {
	worker, err := s.repo.GetWorker(ctx, workerID)
	if err != nil {
		return err
	}

	// Check if worker has active task
	if worker.CurrentTask != "" {
		return errors.New("worker has active task")
	}

	now := time.Now()
	worker.Status = "offline"
	worker.ShiftEnd = now
	worker.LastActive = now

	return s.repo.UpdateWorker(ctx, worker)
}

// SetWorkerBreak sets worker on break
func (s *TaskService) SetWorkerBreak(ctx context.Context, workerID string) error {
	worker, err := s.repo.GetWorker(ctx, workerID)
	if err != nil {
		return err
	}

	if worker.CurrentTask != "" {
		return errors.New("worker has active task")
	}

	worker.Status = "break"
	worker.LastActive = time.Now()

	return s.repo.UpdateWorker(ctx, worker)
}

// GetWorker returns worker by ID
func (s *TaskService) GetWorker(ctx context.Context, id string) (*Worker, error) {
	return s.repo.GetWorker(ctx, id)
}

// ListWorkers returns list of workers
func (s *TaskService) ListWorkers(ctx context.Context, warehouseID string, status string) ([]*Worker, error) {
	return s.repo.ListWorkers(ctx, warehouseID, status)
}

// GetWorkerStats returns worker statistics
func (s *TaskService) GetWorkerStats(ctx context.Context, workerID string, from, to time.Time) (*WorkerStats, error) {
	return s.repo.GetWorkerStats(ctx, workerID, from, to)
}

// GetWarehouseProductivity returns all worker stats for warehouse
func (s *TaskService) GetWarehouseProductivity(ctx context.Context, warehouseID string, from, to time.Time) ([]*WorkerStats, error) {
	stats, err := s.repo.GetWarehouseWorkerStats(ctx, warehouseID, from, to)
	if err != nil {
		return nil, err
	}

	// Sort by productivity score
	sort.Slice(stats, func(i, j int) bool {
		return stats[i].ProductivityScore > stats[j].ProductivityScore
	})

	return stats, nil
}

// OptimizeTaskAssignments optimizes task assignments for efficiency
func (s *TaskService) OptimizeTaskAssignments(ctx context.Context, warehouseID string) error {
	// Get pending tasks
	pendingTasks, err := s.repo.ListTasks(ctx, warehouseID, TaskStatusPending, "", 100, 0)
	if err != nil {
		return err
	}

	// Get available workers
	workers, err := s.repo.ListWorkers(ctx, warehouseID, "available")
	if err != nil {
		return err
	}

	if len(workers) == 0 || len(pendingTasks) == 0 {
		return nil
	}

	// Sort tasks by priority and due date
	sort.Slice(pendingTasks, func(i, j int) bool {
		if pendingTasks[i].Priority != pendingTasks[j].Priority {
			return pendingTasks[i].Priority < pendingTasks[j].Priority
		}
		if pendingTasks[i].DueDate != nil && pendingTasks[j].DueDate != nil {
			return pendingTasks[i].DueDate.Before(*pendingTasks[j].DueDate)
		}
		return false
	})

	// Assign tasks to workers
	workerIndex := 0
	for _, task := range pendingTasks {
		if workerIndex >= len(workers) {
			break
		}

		worker := workers[workerIndex]

		// Check if worker is suitable for task type
		suitable := true
		switch task.Type {
		case TaskTypePicking:
			suitable = worker.Role == "picker" || worker.Role == "general"
		case TaskTypePacking:
			suitable = worker.Role == "packer" || worker.Role == "general"
		case TaskTypePutaway:
			suitable = worker.Role == "receiver" || worker.Role == "general"
		}

		if suitable {
			s.AssignTask(ctx, task.ID, worker.ID)
			workerIndex++
		}
	}

	return nil
}
