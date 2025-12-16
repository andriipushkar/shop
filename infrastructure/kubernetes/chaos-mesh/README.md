# Chaos Mesh Configuration

Chaos Mesh is a cloud-native Chaos Engineering platform for Kubernetes.

## Installation

```bash
# Add Chaos Mesh helm repository
helm repo add chaos-mesh https://charts.chaos-mesh.org

# Install Chaos Mesh
helm install chaos-mesh chaos-mesh/chaos-mesh \
  --namespace=chaos-mesh \
  --create-namespace \
  --set chaosDaemon.runtime=containerd \
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock \
  --set dashboard.securityMode=false
```

## Available Experiments

### Pod Chaos
- Pod Kill
- Pod Failure
- Container Kill

### Network Chaos
- Network Delay
- Network Loss
- Network Partition
- Network Bandwidth

### Stress Chaos
- CPU Stress
- Memory Stress

### IO Chaos
- IO Delay
- IO Error

### Time Chaos
- Time Skew

## Usage

Apply experiments from this directory:

```bash
kubectl apply -f experiments/
```

## Safety Notes

1. Always run chaos experiments in staging first
2. Use proper selectors to target only test workloads
3. Set appropriate duration and schedule
4. Monitor system health during experiments
5. Have rollback procedures ready
