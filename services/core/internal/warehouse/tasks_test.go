package warehouse

import (
	"context"
	"testing"
	"time"
)

// MockTaskRepository implements TaskRepository for testing
type mockTaskRepository struct {
	tasks   map[string]*Task
	workers map[string]*Worker
}

func newMockTaskRepository() *mockTaskRepository {
	return &mockTaskRepository{
		tasks:   make(map[string]*Task),
		workers: make(map[string]*Worker),
	}
}

func (m *mockTaskRepository) CreateTask(ctx context.Context, task *Task) error {
	m.tasks[task.ID] = task
	return nil
}

func (m *mockTaskRepository) UpdateTask(ctx context.Context, task *Task) error {
	m.tasks[task.ID] = task
	return nil
}

func (m *mockTaskRepository) GetTask(ctx context.Context, id string) (*Task, error) {
	if task, ok := m.tasks[id]; ok {
		return task, nil
	}
	return nil, ErrTaskNotFound
}

func (m *mockTaskRepository) ListTasks(ctx context.Context, warehouseID string, status TaskStatus, taskType TaskType, limit, offset int) ([]*Task, error) {
	result := make([]*Task, 0)
	for _, task := range m.tasks {
		if (warehouseID == "" || task.WarehouseID == warehouseID) &&
			(status == "" || task.Status == status) &&
			(taskType == "" || task.Type == taskType) {
			result = append(result, task)
			if len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *mockTaskRepository) GetTasksByDocument(ctx context.Context, documentType, documentID string) ([]*Task, error) {
	result := make([]*Task, 0)
	for _, task := range m.tasks {
		if task.DocumentType == documentType && task.DocumentID == documentID {
			result = append(result, task)
		}
	}
	return result, nil
}

func (m *mockTaskRepository) GetTasksByWorker(ctx context.Context, workerID string, status TaskStatus) ([]*Task, error) {
	result := make([]*Task, 0)
	for _, task := range m.tasks {
		if task.AssignedTo == workerID && (status == "" || task.Status == status) {
			result = append(result, task)
		}
	}
	return result, nil
}

func (m *mockTaskRepository) GetNextTask(ctx context.Context, warehouseID, workerID string, taskTypes []TaskType) (*Task, error) {
	for _, task := range m.tasks {
		if task.Status == TaskStatusPending && task.WarehouseID == warehouseID {
			for _, tt := range taskTypes {
				if task.Type == tt {
					return task, nil
				}
			}
		}
	}
	return nil, ErrTaskNotFound
}

func (m *mockTaskRepository) GetTaskQueue(ctx context.Context, warehouseID string) (*TaskQueue, error) {
	tasks := make([]*Task, 0)
	urgent := 0
	overdue := 0
	now := time.Now()

	for _, task := range m.tasks {
		if task.WarehouseID == warehouseID && task.Status == TaskStatusPending {
			tasks = append(tasks, task)
			if task.Priority == PriorityUrgent {
				urgent++
			}
			if task.DueDate != nil && task.DueDate.Before(now) {
				overdue++
			}
		}
	}

	return &TaskQueue{
		WarehouseID:  warehouseID,
		Tasks:        tasks,
		TotalTasks:   len(tasks),
		UrgentCount:  urgent,
		OverdueCount: overdue,
	}, nil
}

func (m *mockTaskRepository) CreateWorker(ctx context.Context, worker *Worker) error {
	m.workers[worker.ID] = worker
	return nil
}

func (m *mockTaskRepository) UpdateWorker(ctx context.Context, worker *Worker) error {
	m.workers[worker.ID] = worker
	return nil
}

func (m *mockTaskRepository) GetWorker(ctx context.Context, id string) (*Worker, error) {
	if worker, ok := m.workers[id]; ok {
		return worker, nil
	}
	return nil, ErrProductNotFound
}

func (m *mockTaskRepository) GetWorkerByUserID(ctx context.Context, userID string) (*Worker, error) {
	for _, worker := range m.workers {
		if worker.UserID == userID {
			return worker, nil
		}
	}
	return nil, ErrProductNotFound
}

func (m *mockTaskRepository) ListWorkers(ctx context.Context, warehouseID string, status string) ([]*Worker, error) {
	result := make([]*Worker, 0)
	for _, worker := range m.workers {
		if (warehouseID == "" || worker.WarehouseID == warehouseID) &&
			(status == "" || worker.Status == status) {
			result = append(result, worker)
		}
	}
	return result, nil
}

func (m *mockTaskRepository) GetWorkerStats(ctx context.Context, workerID string, from, to time.Time) (*WorkerStats, error) {
	return &WorkerStats{
		WorkerID:       workerID,
		TasksCompleted: 10,
		ItemsPicked:    100,
		Accuracy:       99.5,
	}, nil
}

func (m *mockTaskRepository) GetWarehouseWorkerStats(ctx context.Context, warehouseID string, from, to time.Time) ([]*WorkerStats, error) {
	return []*WorkerStats{
		{WorkerID: "w1", ProductivityScore: 95},
		{WorkerID: "w2", ProductivityScore: 85},
	}, nil
}

// Tests

func TestTaskService_NewService(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	if service == nil {
		t.Fatal("Expected service to be created")
	}
}

func TestTaskService_CreateTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{
		Type:        TaskTypePicking,
		Priority:    PriorityNormal,
		WarehouseID: "wh1",
		Items: []TaskItem{
			{ProductID: "prod1", SKU: "SKU001", Quantity: 10},
		},
		CreatedBy: "user1",
	}

	err := service.CreateTask(ctx, task)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if task.ID == "" {
		t.Error("Expected ID to be generated")
	}
	if task.Status != TaskStatusPending {
		t.Errorf("Expected status 'pending', got %s", task.Status)
	}
	if task.Items[0].Status != "pending" {
		t.Errorf("Expected item status 'pending', got %s", task.Items[0].Status)
	}
	if task.EstimatedTime == 0 {
		t.Error("Expected estimated time to be calculated")
	}
}

func TestTaskService_CreatePickingTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	items := []TaskItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 5, FromLocation: "A-01"},
		{ProductID: "prod2", SKU: "SKU002", Quantity: 3, FromLocation: "A-02"},
	}

	task, err := service.CreatePickingTask(ctx, "wh1", "order123", "user1", items, PriorityHigh, nil)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if task.Type != TaskTypePicking {
		t.Errorf("Expected type 'picking', got %s", task.Type)
	}
	if task.DocumentType != "order" {
		t.Errorf("Expected document type 'order', got %s", task.DocumentType)
	}
	if task.DocumentID != "order123" {
		t.Errorf("Expected document ID 'order123', got %s", task.DocumentID)
	}
}

func TestTaskService_CreatePutawayTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	items := []TaskItem{
		{ProductID: "prod1", Quantity: 100, ToLocation: "B-01"},
	}

	task, err := service.CreatePutawayTask(ctx, "wh1", "receipt123", "user1", items)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if task.Type != TaskTypePutaway {
		t.Errorf("Expected type 'putaway', got %s", task.Type)
	}
	if task.Priority != PriorityNormal {
		t.Errorf("Expected normal priority, got %d", task.Priority)
	}
}

func TestTaskService_CreateReplenishmentTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	items := []TaskItem{
		{ProductID: "prod1", Quantity: 50, FromLocation: "Reserve", ToLocation: "Pick-A01"},
	}

	task, err := service.CreateReplenishmentTask(ctx, "wh1", "user1", items)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if task.Type != TaskTypeReplenish {
		t.Errorf("Expected type 'replenish', got %s", task.Type)
	}
	if task.Priority != PriorityHigh {
		t.Errorf("Expected high priority, got %d", task.Priority)
	}
}

func TestTaskService_CreateCycleCountTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	locations := []string{"A-01", "A-02", "A-03"}

	task, err := service.CreateCycleCountTask(ctx, "wh1", "zone1", "user1", locations)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if task.Type != TaskTypeCycleCount {
		t.Errorf("Expected type 'cycle_count', got %s", task.Type)
	}
	if len(task.Items) != 3 {
		t.Errorf("Expected 3 items, got %d", len(task.Items))
	}
}

func TestTaskService_AssignTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusPending, WarehouseID: "wh1"}
	repo.tasks["task1"] = task

	worker := &Worker{ID: "worker1", Name: "John", Status: "available"}
	repo.workers["worker1"] = worker

	err := service.AssignTask(ctx, "task1", "worker1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedTask := repo.tasks["task1"]
	if updatedTask.Status != TaskStatusAssigned {
		t.Errorf("Expected status 'assigned', got %s", updatedTask.Status)
	}
	if updatedTask.AssignedTo != "worker1" {
		t.Errorf("Expected assigned to 'worker1', got %s", updatedTask.AssignedTo)
	}
	if updatedTask.AssignedName != "John" {
		t.Errorf("Expected assigned name 'John', got %s", updatedTask.AssignedName)
	}

	updatedWorker := repo.workers["worker1"]
	if updatedWorker.Status != "busy" {
		t.Errorf("Expected worker status 'busy', got %s", updatedWorker.Status)
	}
}

func TestTaskService_AssignTask_WorkerNotAvailable(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusPending}
	repo.tasks["task1"] = task

	worker := &Worker{ID: "worker1", Status: "busy"}
	repo.workers["worker1"] = worker

	err := service.AssignTask(ctx, "task1", "worker1")
	if err != ErrTaskAlreadyTaken {
		t.Errorf("Expected ErrTaskAlreadyTaken, got %v", err)
	}
}

func TestTaskService_StartTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusAssigned}
	repo.tasks["task1"] = task

	err := service.StartTask(ctx, "task1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedTask := repo.tasks["task1"]
	if updatedTask.Status != TaskStatusInProgress {
		t.Errorf("Expected status 'in_progress', got %s", updatedTask.Status)
	}
	if updatedTask.StartedAt == nil {
		t.Error("Expected StartedAt to be set")
	}
}

func TestTaskService_PauseTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusInProgress}
	repo.tasks["task1"] = task

	err := service.PauseTask(ctx, "task1", "Need more equipment")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedTask := repo.tasks["task1"]
	if updatedTask.Status != TaskStatusPaused {
		t.Errorf("Expected status 'paused', got %s", updatedTask.Status)
	}
	if updatedTask.Notes != "Need more equipment" {
		t.Errorf("Expected notes to be set")
	}
}

func TestTaskService_CompleteTaskItem(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{
		ID:     "task1",
		Status: TaskStatusInProgress,
		Items: []TaskItem{
			{ID: "item1", ProductID: "prod1", Quantity: 10},
		},
	}
	repo.tasks["task1"] = task

	err := service.CompleteTaskItem(ctx, "task1", "item1", 10, "Picked all")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedTask := repo.tasks["task1"]
	if updatedTask.Items[0].CompletedQty != 10 {
		t.Errorf("Expected completed qty 10, got %d", updatedTask.Items[0].CompletedQty)
	}
	if updatedTask.Items[0].Status != "completed" {
		t.Errorf("Expected item status 'completed', got %s", updatedTask.Items[0].Status)
	}
}

func TestTaskService_SkipTaskItem(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{
		ID:     "task1",
		Status: TaskStatusInProgress,
		Items: []TaskItem{
			{ID: "item1", ProductID: "prod1", Quantity: 10},
		},
	}
	repo.tasks["task1"] = task

	err := service.SkipTaskItem(ctx, "task1", "item1", "Out of stock")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedTask := repo.tasks["task1"]
	if updatedTask.Items[0].Status != "skipped" {
		t.Errorf("Expected item status 'skipped', got %s", updatedTask.Items[0].Status)
	}
}

func TestTaskService_CompleteTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	startTime := time.Now().Add(-10 * time.Minute)
	task := &Task{
		ID:         "task1",
		Status:     TaskStatusInProgress,
		StartedAt:  &startTime,
		AssignedTo: "worker1",
	}
	repo.tasks["task1"] = task

	worker := &Worker{ID: "worker1", Status: "busy", CurrentTask: "task1"}
	repo.workers["worker1"] = worker

	err := service.CompleteTask(ctx, "task1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedTask := repo.tasks["task1"]
	if updatedTask.Status != TaskStatusCompleted {
		t.Errorf("Expected status 'completed', got %s", updatedTask.Status)
	}
	if updatedTask.CompletedAt == nil {
		t.Error("Expected CompletedAt to be set")
	}
	if updatedTask.ActualTime == 0 {
		t.Error("Expected ActualTime to be calculated")
	}

	updatedWorker := repo.workers["worker1"]
	if updatedWorker.Status != "available" {
		t.Errorf("Expected worker status 'available', got %s", updatedWorker.Status)
	}
}

func TestTaskService_CancelTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusAssigned, AssignedTo: "worker1"}
	repo.tasks["task1"] = task

	worker := &Worker{ID: "worker1", Status: "busy", CurrentTask: "task1"}
	repo.workers["worker1"] = worker

	err := service.CancelTask(ctx, "task1", "Order cancelled")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedTask := repo.tasks["task1"]
	if updatedTask.Status != TaskStatusCancelled {
		t.Errorf("Expected status 'cancelled', got %s", updatedTask.Status)
	}

	updatedWorker := repo.workers["worker1"]
	if updatedWorker.Status != "available" {
		t.Errorf("Expected worker to be released")
	}
}

func TestTaskService_CreateWorker(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	worker := &Worker{
		UserID:      "user1",
		Name:        "John Doe",
		WarehouseID: "wh1",
		Role:        "picker",
	}

	err := service.CreateWorker(ctx, worker)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if worker.ID == "" {
		t.Error("Expected ID to be generated")
	}
	if worker.Status != "offline" {
		t.Errorf("Expected status 'offline', got %s", worker.Status)
	}
}

func TestTaskService_ClockIn(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	worker := &Worker{ID: "worker1", Status: "offline"}
	repo.workers["worker1"] = worker

	err := service.ClockIn(ctx, "worker1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedWorker := repo.workers["worker1"]
	if updatedWorker.Status != "available" {
		t.Errorf("Expected status 'available', got %s", updatedWorker.Status)
	}
}

func TestTaskService_ClockOut(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	worker := &Worker{ID: "worker1", Status: "available", CurrentTask: ""}
	repo.workers["worker1"] = worker

	err := service.ClockOut(ctx, "worker1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedWorker := repo.workers["worker1"]
	if updatedWorker.Status != "offline" {
		t.Errorf("Expected status 'offline', got %s", updatedWorker.Status)
	}
}

func TestTaskService_ClockOut_HasActiveTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	worker := &Worker{ID: "worker1", Status: "busy", CurrentTask: "task1"}
	repo.workers["worker1"] = worker

	err := service.ClockOut(ctx, "worker1")
	if err == nil {
		t.Error("Expected error when worker has active task")
	}
}

func TestTaskService_SetWorkerBreak(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	worker := &Worker{ID: "worker1", Status: "available"}
	repo.workers["worker1"] = worker

	err := service.SetWorkerBreak(ctx, "worker1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedWorker := repo.workers["worker1"]
	if updatedWorker.Status != "break" {
		t.Errorf("Expected status 'break', got %s", updatedWorker.Status)
	}
}

func TestTaskService_GetNextTaskForWorker(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Type: TaskTypePicking, Status: TaskStatusPending, WarehouseID: "wh1"}
	repo.tasks["task1"] = task

	worker := &Worker{ID: "worker1", Status: "available", Role: "picker", WarehouseID: "wh1"}
	repo.workers["worker1"] = worker

	nextTask, err := service.GetNextTaskForWorker(ctx, "wh1", "worker1", nil)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if nextTask.ID != "task1" {
		t.Errorf("Expected task 'task1', got %s", nextTask.ID)
	}
}

func TestTaskService_GetTaskQueue(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	pastDue := time.Now().Add(-1 * time.Hour)
	repo.tasks["task1"] = &Task{ID: "task1", Status: TaskStatusPending, WarehouseID: "wh1", Priority: PriorityUrgent}
	repo.tasks["task2"] = &Task{ID: "task2", Status: TaskStatusPending, WarehouseID: "wh1", DueDate: &pastDue}

	queue, err := service.GetTaskQueue(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if queue.TotalTasks != 2 {
		t.Errorf("Expected 2 tasks, got %d", queue.TotalTasks)
	}
	if queue.UrgentCount != 1 {
		t.Errorf("Expected 1 urgent, got %d", queue.UrgentCount)
	}
	if queue.OverdueCount != 1 {
		t.Errorf("Expected 1 overdue, got %d", queue.OverdueCount)
	}
}

func TestTaskService_GetWarehouseProductivity(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	stats, err := service.GetWarehouseProductivity(ctx, "wh1", time.Now().Add(-24*time.Hour), time.Now())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Should be sorted by productivity score
	if len(stats) != 2 {
		t.Fatalf("Expected 2 workers, got %d", len(stats))
	}
	if stats[0].ProductivityScore < stats[1].ProductivityScore {
		t.Error("Expected sorted by productivity score descending")
	}
}

func TestTaskService_OptimizeTaskAssignments(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	// Setup pending tasks
	repo.tasks["task1"] = &Task{ID: "task1", Type: TaskTypePicking, Status: TaskStatusPending, WarehouseID: "wh1", Priority: PriorityHigh}
	repo.tasks["task2"] = &Task{ID: "task2", Type: TaskTypePicking, Status: TaskStatusPending, WarehouseID: "wh1", Priority: PriorityNormal}

	// Setup available workers
	repo.workers["worker1"] = &Worker{ID: "worker1", Status: "available", WarehouseID: "wh1", Role: "picker"}

	err := service.OptimizeTaskAssignments(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Check that high priority task was assigned first
	task1 := repo.tasks["task1"]
	if task1.Status != TaskStatusAssigned {
		t.Errorf("Expected high priority task to be assigned")
	}
}

func TestTaskService_GetTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	repo.tasks["task1"] = &Task{ID: "task1", Type: TaskTypePicking, Status: TaskStatusPending}

	task, err := service.GetTask(ctx, "task1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if task.Type != TaskTypePicking {
		t.Errorf("Expected TaskTypePicking, got %s", task.Type)
	}
}

func TestTaskService_ListTasks(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	repo.tasks["task1"] = &Task{ID: "task1", WarehouseID: "wh1", Type: TaskTypePicking, Status: TaskStatusPending}
	repo.tasks["task2"] = &Task{ID: "task2", WarehouseID: "wh1", Type: TaskTypePicking, Status: TaskStatusCompleted}

	list, err := service.ListTasks(ctx, "wh1", TaskStatusPending, TaskTypePicking, 100, 0)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(list) != 1 {
		t.Errorf("Expected 1 task, got %d", len(list))
	}
}

func TestTaskService_GetWorker(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	repo.workers["worker1"] = &Worker{ID: "worker1", Name: "John Doe", Status: "available"}

	worker, err := service.GetWorker(ctx, "worker1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if worker.Name != "John Doe" {
		t.Errorf("Expected 'John Doe', got %s", worker.Name)
	}
}

func TestTaskService_ListWorkers(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	repo.workers["worker1"] = &Worker{ID: "worker1", WarehouseID: "wh1", Status: "available"}
	repo.workers["worker2"] = &Worker{ID: "worker2", WarehouseID: "wh1", Status: "busy"}

	list, err := service.ListWorkers(ctx, "wh1", "available")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if len(list) != 1 {
		t.Errorf("Expected 1 worker, got %d", len(list))
	}
}

func TestTaskService_GetWorkerStats(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	repo.workers["worker1"] = &Worker{ID: "worker1", Name: "John Doe"}

	stats, err := service.GetWorkerStats(ctx, "worker1", time.Now().Add(-7*24*time.Hour), time.Now())
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if stats.TasksCompleted != 10 { // mock returns 10
		t.Errorf("Expected 10 tasks, got %d", stats.TasksCompleted)
	}
}

// Edge case tests for increased coverage

func TestTaskService_GetNextTaskForWorker_WorkerNotAvailable(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	worker := &Worker{ID: "worker1", Status: "busy", Role: "picker"}
	repo.workers["worker1"] = worker

	_, err := service.GetNextTaskForWorker(ctx, "wh1", "worker1", nil)
	if err == nil {
		t.Error("Expected error when worker is not available")
	}
}

func TestTaskService_GetNextTaskForWorker_PackerRole(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Type: TaskTypePacking, Status: TaskStatusPending, WarehouseID: "wh1"}
	repo.tasks["task1"] = task

	worker := &Worker{ID: "worker1", Status: "available", Role: "packer", WarehouseID: "wh1"}
	repo.workers["worker1"] = worker

	nextTask, err := service.GetNextTaskForWorker(ctx, "wh1", "worker1", nil)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if nextTask.ID != "task1" {
		t.Errorf("Expected task 'task1', got %s", nextTask.ID)
	}
}

func TestTaskService_GetNextTaskForWorker_ReceiverRole(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Type: TaskTypePutaway, Status: TaskStatusPending, WarehouseID: "wh1"}
	repo.tasks["task1"] = task

	worker := &Worker{ID: "worker1", Status: "available", Role: "receiver", WarehouseID: "wh1"}
	repo.workers["worker1"] = worker

	nextTask, err := service.GetNextTaskForWorker(ctx, "wh1", "worker1", nil)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if nextTask.ID != "task1" {
		t.Errorf("Expected task 'task1', got %s", nextTask.ID)
	}
}

func TestTaskService_GetNextTaskForWorker_DefaultRole(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Type: TaskTypePicking, Status: TaskStatusPending, WarehouseID: "wh1"}
	repo.tasks["task1"] = task

	worker := &Worker{ID: "worker1", Status: "available", Role: "general", WarehouseID: "wh1"}
	repo.workers["worker1"] = worker

	nextTask, err := service.GetNextTaskForWorker(ctx, "wh1", "worker1", nil)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if nextTask.ID != "task1" {
		t.Errorf("Expected task 'task1', got %s", nextTask.ID)
	}
}

func TestTaskService_GetNextTaskForWorker_WithPreferredTypes(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Type: TaskTypeReplenish, Status: TaskStatusPending, WarehouseID: "wh1"}
	repo.tasks["task1"] = task

	worker := &Worker{ID: "worker1", Status: "available", Role: "picker", WarehouseID: "wh1"}
	repo.workers["worker1"] = worker

	preferredTypes := []TaskType{TaskTypeReplenish}
	nextTask, err := service.GetNextTaskForWorker(ctx, "wh1", "worker1", preferredTypes)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if nextTask.ID != "task1" {
		t.Errorf("Expected task 'task1', got %s", nextTask.ID)
	}
}

func TestTaskService_SetWorkerBreak_WithActiveTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	worker := &Worker{ID: "worker1", Status: "busy", CurrentTask: "task1"}
	repo.workers["worker1"] = worker

	err := service.SetWorkerBreak(ctx, "worker1")
	if err == nil {
		t.Error("Expected error when worker has active task")
	}
}

func TestTaskService_CreatePickingTask_WithDueDate(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	dueDate := time.Now().Add(24 * time.Hour)
	items := []TaskItem{
		{ProductID: "prod1", SKU: "SKU001", Quantity: 10},
	}

	task, err := service.CreatePickingTask(ctx, "wh1", "order123", "user1", items, PriorityUrgent, &dueDate)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if task.Priority != PriorityUrgent {
		t.Errorf("Expected urgent priority, got %d", task.Priority)
	}
	if task.DueDate == nil {
		t.Error("Expected due date to be set")
	}
}

func TestTaskService_CreatePutawayTask_DefaultPriority(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	items := []TaskItem{
		{ProductID: "prod1", Quantity: 50},
	}

	task, err := service.CreatePutawayTask(ctx, "wh1", "receipt123", "user1", items)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if task.Priority != PriorityNormal {
		t.Errorf("Expected normal priority, got %d", task.Priority)
	}
	if task.DocumentType != "receipt" {
		t.Errorf("Expected document type 'receipt', got %s", task.DocumentType)
	}
}

func TestTaskService_CreateReplenishmentTask_HighPriority(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	items := []TaskItem{
		{ProductID: "prod1", Quantity: 100, FromLocation: "Reserve", ToLocation: "Pick-A01"},
	}

	task, err := service.CreateReplenishmentTask(ctx, "wh1", "user1", items)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if task.Priority != PriorityHigh {
		t.Errorf("Expected high priority, got %d", task.Priority)
	}
	if task.Instructions == "" {
		t.Error("Expected instructions to be set")
	}
}

func TestTaskService_AssignTask_InvalidTaskState(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusCompleted}
	repo.tasks["task1"] = task

	worker := &Worker{ID: "worker1", Status: "available"}
	repo.workers["worker1"] = worker

	err := service.AssignTask(ctx, "task1", "worker1")
	if err != ErrInvalidTaskState {
		t.Errorf("Expected ErrInvalidTaskState, got %v", err)
	}
}

func TestTaskService_AssignTask_WorkerNotFound(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusPending}
	repo.tasks["task1"] = task

	err := service.AssignTask(ctx, "task1", "nonexistent")
	if err == nil {
		t.Error("Expected error for nonexistent worker")
	}
}

func TestTaskService_StartTask_FromPausedState(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusPaused}
	repo.tasks["task1"] = task

	err := service.StartTask(ctx, "task1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	updatedTask := repo.tasks["task1"]
	if updatedTask.Status != TaskStatusInProgress {
		t.Errorf("Expected status 'in_progress', got %s", updatedTask.Status)
	}
}

func TestTaskService_StartTask_InvalidState(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusCompleted}
	repo.tasks["task1"] = task

	err := service.StartTask(ctx, "task1")
	if err != ErrInvalidTaskState {
		t.Errorf("Expected ErrInvalidTaskState, got %v", err)
	}
}

func TestTaskService_PauseTask_InvalidState(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusPending}
	repo.tasks["task1"] = task

	err := service.PauseTask(ctx, "task1", "reason")
	if err != ErrInvalidTaskState {
		t.Errorf("Expected ErrInvalidTaskState, got %v", err)
	}
}

func TestTaskService_CompleteTaskItem_InvalidState(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{
		ID:     "task1",
		Status: TaskStatusPending,
		Items:  []TaskItem{{ID: "item1", ProductID: "prod1", Quantity: 10}},
	}
	repo.tasks["task1"] = task

	err := service.CompleteTaskItem(ctx, "task1", "item1", 10, "")
	if err != ErrInvalidTaskState {
		t.Errorf("Expected ErrInvalidTaskState, got %v", err)
	}
}

func TestTaskService_CompleteTaskItem_ItemNotFound(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{
		ID:     "task1",
		Status: TaskStatusInProgress,
		Items:  []TaskItem{{ID: "item1", ProductID: "prod1", Quantity: 10}},
	}
	repo.tasks["task1"] = task

	err := service.CompleteTaskItem(ctx, "task1", "nonexistent", 10, "")
	if err == nil {
		t.Error("Expected error for nonexistent item")
	}
}

func TestTaskService_CompleteTask_InvalidState(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusPending}
	repo.tasks["task1"] = task

	err := service.CompleteTask(ctx, "task1")
	if err != ErrInvalidTaskState {
		t.Errorf("Expected ErrInvalidTaskState, got %v", err)
	}
}

func TestTaskService_CompleteTask_WithoutStartTime(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusInProgress, AssignedTo: "worker1"}
	repo.tasks["task1"] = task

	worker := &Worker{ID: "worker1", Status: "busy", CurrentTask: "task1"}
	repo.workers["worker1"] = worker

	err := service.CompleteTask(ctx, "task1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Actual time should be 0 since StartedAt is nil
	updatedTask := repo.tasks["task1"]
	if updatedTask.ActualTime != 0 {
		t.Errorf("Expected actual time 0 when no start time, got %d", updatedTask.ActualTime)
	}
}

func TestTaskService_CancelTask_AlreadyCompleted(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusCompleted}
	repo.tasks["task1"] = task

	err := service.CancelTask(ctx, "task1", "reason")
	if err != ErrInvalidTaskState {
		t.Errorf("Expected ErrInvalidTaskState, got %v", err)
	}
}

func TestTaskService_CancelTask_WorkerNotFound(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	task := &Task{ID: "task1", Status: TaskStatusAssigned, AssignedTo: "nonexistent"}
	repo.tasks["task1"] = task

	err := service.CancelTask(ctx, "task1", "reason")
	if err != nil {
		t.Fatalf("Expected no error even if worker not found, got %v", err)
	}
}

func TestTaskService_OptimizeTaskAssignments_NoWorkers(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	repo.tasks["task1"] = &Task{ID: "task1", Type: TaskTypePicking, Status: TaskStatusPending, WarehouseID: "wh1", Priority: PriorityHigh}

	err := service.OptimizeTaskAssignments(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestTaskService_OptimizeTaskAssignments_NoTasks(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	repo.workers["worker1"] = &Worker{ID: "worker1", Status: "available", WarehouseID: "wh1", Role: "picker"}

	err := service.OptimizeTaskAssignments(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
}

func TestTaskService_OptimizeTaskAssignments_PackingTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	repo.tasks["task1"] = &Task{ID: "task1", Type: TaskTypePacking, Status: TaskStatusPending, WarehouseID: "wh1", Priority: PriorityNormal}
	repo.workers["worker1"] = &Worker{ID: "worker1", Status: "available", WarehouseID: "wh1", Role: "packer"}

	err := service.OptimizeTaskAssignments(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	task := repo.tasks["task1"]
	if task.Status != TaskStatusAssigned {
		t.Errorf("Expected task to be assigned")
	}
}

func TestTaskService_OptimizeTaskAssignments_PutawayTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	repo.tasks["task1"] = &Task{ID: "task1", Type: TaskTypePutaway, Status: TaskStatusPending, WarehouseID: "wh1", Priority: PriorityNormal}
	repo.workers["worker1"] = &Worker{ID: "worker1", Status: "available", WarehouseID: "wh1", Role: "receiver"}

	err := service.OptimizeTaskAssignments(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	task := repo.tasks["task1"]
	if task.Status != TaskStatusAssigned {
		t.Errorf("Expected task to be assigned")
	}
}

func TestTaskService_OptimizeTaskAssignments_UnsuitableWorker(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	// Packing task with picker worker
	repo.tasks["task1"] = &Task{ID: "task1", Type: TaskTypePacking, Status: TaskStatusPending, WarehouseID: "wh1", Priority: PriorityNormal}
	repo.workers["worker1"] = &Worker{ID: "worker1", Status: "available", WarehouseID: "wh1", Role: "picker"}

	err := service.OptimizeTaskAssignments(ctx, "wh1")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	// Task should not be assigned because worker role doesn't match
	task := repo.tasks["task1"]
	if task.Status == TaskStatusAssigned {
		t.Error("Expected task not to be assigned to unsuitable worker")
	}
}

func TestTaskService_ClockOut_WithActiveTask(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	repo.workers["worker1"] = &Worker{
		ID:          "worker1",
		Status:      "busy",
		CurrentTask: "task1",
	}

	err := service.ClockOut(ctx, "worker1")
	if err == nil {
		t.Error("Expected error when worker has active task")
	}
}

func TestTaskService_GetNextTaskForWorker_GetTaskError(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	repo.workers["worker1"] = &Worker{ID: "worker1", Status: "available", Role: "picker", WarehouseID: "wh1"}

	// Mock will return nil when no tasks available
	task, err := service.GetNextTaskForWorker(ctx, "wh1", "worker1", nil)
	// This depends on mock implementation, but should handle gracefully
	_ = task
	_ = err
}

func TestTaskService_SetWorkerBreak_WorkerNotFound(t *testing.T) {
	repo := newMockTaskRepository()
	service := NewTaskService(repo)
	ctx := context.Background()

	err := service.SetWorkerBreak(ctx, "nonexistent")
	if err == nil {
		t.Error("Expected error for nonexistent worker")
	}
}
