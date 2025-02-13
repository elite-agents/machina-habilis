import { useState } from 'react';
import { useAgents } from '../context/AgentContext';

const EmptyState = () => {
  const [newAgentName, setNewAgentName] = useState('');
  const { createAgent } = useAgents();

  const handleCreate = (e) => {
    e.preventDefault();
    if (newAgentName.trim()) {
      createAgent(newAgentName.trim());
      setNewAgentName('');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-6 p-8 max-w-md">
        <h2 className="text-2xl font-semibold text-gray-200">
          Create or Select an Agent
        </h2>
        <p className="text-gray-400">
          Create a new agent to start chatting or select an existing one from
          the sidebar.
        </p>
        <form onSubmit={handleCreate} className="space-y-4">
          <input
            type="text"
            value={newAgentName}
            onChange={(e) => setNewAgentName(e.target.value)}
            placeholder="Enter agent name"
            className="w-full bg-gray-900 text-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={!newAgentName.trim()}
            className="w-full bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Agent
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmptyState;
