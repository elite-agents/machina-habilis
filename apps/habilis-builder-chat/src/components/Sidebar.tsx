import { useState } from 'react';
import { useAgents } from '../context/AgentContext';

const navItems = [{ icon: 'G', label: 'Habilis', type: 'logo' }];

const Sidebar = () => {
  const { agents, selectedAgent, setSelectedAgent, createAgent } = useAgents();
  const [newAgentName, setNewAgentName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = (e) => {
    e.preventDefault();
    if (newAgentName.trim()) {
      createAgent(newAgentName.trim());
      setNewAgentName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed left-0 top-0 h-screen w-56 bg-[#1a1a1a] text-gray-300 p-4 flex flex-col">
      <nav className="space-y-4">
        {navItems.map((item) => (
          <div
            key={item.label}
            className={`flex items-center space-x-3 p-2 rounded hover:bg-gray-800 cursor-pointer
              ${item.type === 'logo' ? 'mb-8' : ''}`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="mt-8 border-t border-gray-800 pt-4 flex-1">
        <h3 className="text-sm text-gray-500 mb-4">Agents</h3>

        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className={`flex items-center space-x-2 p-2 rounded cursor-pointer
                ${selectedAgent?.id === agent.id ? 'bg-gray-800' : 'hover:bg-gray-800'}`}
            >
              <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center text-white text-sm">
                {agent.image}
              </div>
              <span>{agent.name}</span>
            </div>
          ))}
        </div>

        {isCreating ? (
          <form onSubmit={handleCreate} className="mt-4">
            <input
              autoFocus
              type="text"
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
              placeholder="Agent name"
              className="w-full bg-gray-900 text-gray-200 rounded px-3 py-2 text-sm"
            />
          </form>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center space-x-2 text-green-500 hover:bg-gray-800 p-2 rounded w-full mt-4"
          >
            <span>+</span>
            <span>Create</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
