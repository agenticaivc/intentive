import { TopologicalSorter } from '../src/TopologicalSorter';
import { IntentNode, IntentEdge } from '../src/types';

describe('TopologicalSorter', () => {
  let sorter: TopologicalSorter;

  beforeEach(() => {
    sorter = new TopologicalSorter();
  });

  describe('sort', () => {
    it('should sort nodes in dependency order', () => {
      const nodes: IntentNode[] = [
        {
          id: 'node1',
          type: 'action',
          properties: { name: 'Node 1', handler: 'test.handler' }
        },
        {
          id: 'node2',
          type: 'action',
          properties: { name: 'Node 2', handler: 'test.handler' }
        },
        {
          id: 'node3',
          type: 'action',
          properties: { name: 'Node 3', handler: 'test.handler' }
        }
      ];

      const edges: IntentEdge[] = [
        {
          id: 'edge1',
          from: 'node1',
          to: 'node2',
          type: 'sequence'
        },
        {
          id: 'edge2',
          from: 'node2',
          to: 'node3',
          type: 'sequence'
        }
      ];

      const result = sorter.sort(nodes, edges);

      expect(result.hasValidTopology).toBe(true);
      expect(result.cycles).toHaveLength(0);
      expect(result.sorted).toEqual(['node1', 'node2', 'node3']);
    });

    it('should detect cycles', () => {
      const nodes: IntentNode[] = [
        {
          id: 'node1',
          type: 'action',
          properties: { name: 'Node 1', handler: 'test.handler' }
        },
        {
          id: 'node2',
          type: 'action',
          properties: { name: 'Node 2', handler: 'test.handler' }
        }
      ];

      const edges: IntentEdge[] = [
        {
          id: 'edge1',
          from: 'node1',
          to: 'node2',
          type: 'sequence'
        },
        {
          id: 'edge2',
          from: 'node2',
          to: 'node1',
          type: 'sequence'
        }
      ];

      const result = sorter.sort(nodes, edges);

      expect(result.hasValidTopology).toBe(false);
      expect(result.cycles.length).toBeGreaterThan(0);
      expect(result.sorted).toHaveLength(0);
    });

    it('should handle nodes with no dependencies', () => {
      const nodes: IntentNode[] = [
        {
          id: 'node1',
          type: 'action',
          properties: { name: 'Node 1', handler: 'test.handler' }
        }
      ];

      const edges: IntentEdge[] = [];

      const result = sorter.sort(nodes, edges);

      expect(result.hasValidTopology).toBe(true);
      expect(result.cycles).toHaveLength(0);
      expect(result.sorted).toEqual(['node1']);
    });

    it('should throw error for non-existent nodes in edges', () => {
      const nodes: IntentNode[] = [
        {
          id: 'node1',
          type: 'action',
          properties: { name: 'Node 1', handler: 'test.handler' }
        }
      ];

      const edges: IntentEdge[] = [
        {
          id: 'edge1',
          from: 'node1',
          to: 'nonexistent',
          type: 'sequence'
        }
      ];

      expect(() => sorter.sort(nodes, edges)).toThrow('Edge references non-existent target node: nonexistent');
    });
  });
}); 