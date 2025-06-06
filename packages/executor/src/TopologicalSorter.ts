import { IntentNode, IntentEdge } from './types';

export interface TopologicalSortResult {
  sorted: string[];
  cycles: string[][];
  hasValidTopology: boolean;
}

export class TopologicalSorter {
  /**
   * Performs topological sort on graph nodes based on edge dependencies
   * Returns sorted order for execution or detects cycles
   */
  sort(nodes: IntentNode[], edges: IntentEdge[]): TopologicalSortResult {
    const nodeIds = new Set(nodes.map(n => n.id));
    const adjacencyList = this.buildAdjacencyList(edges, nodeIds);
    const inDegree = this.calculateInDegree(adjacencyList, nodeIds);
    
    // Detect cycles using DFS
    const cycles = this.detectCycles(adjacencyList, nodeIds);
    if (cycles.length > 0) {
      return {
        sorted: [],
        cycles,
        hasValidTopology: false
      };
    }

    // Kahn's algorithm for topological sort
    const sorted = this.kahnsAlgorithm(adjacencyList, inDegree);
    
    return {
      sorted,
      cycles: [],
      hasValidTopology: sorted.length === nodeIds.size
    };
  }

  private buildAdjacencyList(edges: IntentEdge[], nodeIds: Set<string>): Map<string, Set<string>> {
    const adjacencyList = new Map<string, Set<string>>();
    
    // Initialize adjacency list for all nodes
    for (const nodeId of nodeIds) {
      adjacencyList.set(nodeId, new Set());
    }

    // Build edges - validate that both nodes exist
    for (const edge of edges) {
      if (!nodeIds.has(edge.from)) {
        throw new Error(`Edge references non-existent source node: ${edge.from}`);
      }
      if (!nodeIds.has(edge.to)) {
        throw new Error(`Edge references non-existent target node: ${edge.to}`);
      }
      
      adjacencyList.get(edge.from)!.add(edge.to);
    }

    return adjacencyList;
  }

  private calculateInDegree(adjacencyList: Map<string, Set<string>>, nodeIds: Set<string>): Map<string, number> {
    const inDegree = new Map<string, number>();
    
    // Initialize in-degree for all nodes
    for (const nodeId of nodeIds) {
      inDegree.set(nodeId, 0);
    }

    // Calculate in-degree for each node
    for (const [, neighbors] of adjacencyList) {
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, inDegree.get(neighbor)! + 1);
      }
    }

    return inDegree;
  }

  private detectCycles(adjacencyList: Map<string, Set<string>>, nodeIds: Set<string>): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjacencyList.get(nodeId) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStartIndex = path.indexOf(neighbor);
          const cycle = [...path.slice(cycleStartIndex), neighbor];
          cycles.push(cycle);
        }
      }

      recursionStack.delete(nodeId);
    };

    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  private kahnsAlgorithm(adjacencyList: Map<string, Set<string>>, inDegree: Map<string, number>): string[] {
    const sorted: string[] = [];
    const queue: string[] = [];

    // Find all nodes with no incoming edges
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const currentNode = queue.shift()!;
      sorted.push(currentNode);

      // Process all neighbors
      const neighbors = adjacencyList.get(currentNode) || new Set();
      for (const neighbor of neighbors) {
        const newDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDegree);
        
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return sorted;
  }
} 