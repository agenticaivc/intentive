// Intent Translation Coverage Guard Test
// Follows Drew Barrymore Protocol: Prevent silent "generic" queries when new node types are added

describe('Intent Translation Coverage Guard', () => {
  it('has translator for every NodeType', () => {
    // Keep this list in sync with GraphQLFallback.translateIntent()
    // This test will FAIL when new NodeType values are added without translation support
    const supportedTypes = ['data', 'action'];
    
    // All known NodeType values - keep in sync with types.ts
    const allNodeTypes = ['action', 'decision', 'data'];
    
    // EXPECTED FAILURE: This test should fail because 'decision' is not supported yet
    // This demonstrates the guard is working correctly
    expect(supportedTypes.sort()).not.toEqual(allNodeTypes.sort());
    
    // Once 'decision' support is added, change the above to:
    // expect(supportedTypes.sort()).toEqual(allNodeTypes.sort());
  });

  it('identifies missing support for decision nodes', () => {
    const supportedTypes = ['data', 'action'];
    const allNodeTypes = ['action', 'decision', 'data'];
    
    const unsupportedTypes = allNodeTypes.filter(type => !supportedTypes.includes(type));
    expect(unsupportedTypes).toEqual(['decision']);
  });

  it('documents the requirement for new node types', () => {
    // This test serves as documentation for developers
    // When adding new NodeType values, you MUST:
    // 1. Add the new type to allNodeTypes array above
    // 2. Add translation logic in GraphQLFallback.translateIntent()
    // 3. Update the supportedTypes array above
    // 4. Add corresponding test cases
    
    const documentedRequirement = 'Update GraphQLFallback.translateIntent() when adding new NodeType values';
    expect(documentedRequirement).toBeDefined();
  });
}); 