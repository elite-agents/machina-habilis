import { useState, useEffect } from 'react';
import { useAgents } from '../context/AgentContext';

const AgentDetails = () => {
  const { selectedAgent, updateAgent, habilisServerTools } = useAgents();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [tempName, setTempName] = useState(selectedAgent?.name || '');
  const [tempDesc, setTempDesc] = useState(selectedAgent?.description || '');

  // Update temp states when selected agent changes
  useEffect(() => {
    setTempName(selectedAgent?.name || '');
    setTempDesc(selectedAgent?.description || '');
  }, [selectedAgent]);

  const handleNameSubmit = () => {
    if (tempName.trim() && tempName !== selectedAgent?.name) {
      updateAgent(selectedAgent?.id as number, { name: tempName.trim() });
    }
    setIsEditingName(false);
  };

  const handleDescSubmit = () => {
    if (tempDesc !== selectedAgent?.description) {
      updateAgent(selectedAgent?.id as number, { description: tempDesc });
    }
    setIsEditingDesc(false);
  };

  const handleToolDrop = (e) => {
    e.preventDefault();
    const tool = e.dataTransfer.getData('application/json');

    if (tool && selectedAgent) {
      selectedAgent.machinaInstance?.learnAbility(tool);
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white">
            {selectedAgent?.image}
          </div>
          <h2 className="text-xl font-semibold text-gray-200">
            {selectedAgent?.name}
          </h2>
        </div>
        <div className="flex items-center space-x-4">
          <button className="text-gray-400 hover:text-gray-200">
            Overview
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 bg-[#1a1a1a] rounded-lg">
            <span className="text-gray-400">Name</span>
            {isEditingName ? (
              <div className="flex items-center space-x-2">
                <input
                  autoFocus
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={handleNameSubmit}
                  onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                  className="bg-gray-900 text-gray-200 rounded px-2 py-1"
                />
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-gray-200">{selectedAgent?.name}</span>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="text-green-500 hover:text-green-400"
                >
                  ✏️
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center p-4 bg-[#1a1a1a] rounded-lg">
            <span className="text-gray-400">Description</span>
            {isEditingDesc ? (
              <div className="flex items-center space-x-2">
                <input
                  autoFocus
                  type="text"
                  value={tempDesc}
                  onChange={(e) => setTempDesc(e.target.value)}
                  onBlur={handleDescSubmit}
                  onKeyPress={(e) => e.key === 'Enter' && handleDescSubmit()}
                  className="bg-gray-900 text-gray-200 rounded px-2 py-1 w-64"
                />
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 italic">
                  {selectedAgent?.description ||
                    `Add a description for Agent ${selectedAgent?.name}`}
                </span>
                <button
                  onClick={() => setIsEditingDesc(true)}
                  className="text-green-500 hover:text-green-400"
                >
                  ✏️
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Current Abilities */}
        <div className="mt-4">
          <h3 className="text-gray-200 text-lg font-semibold mb-2">
            Current Abilities
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {selectedAgent?.machinaInstance?.tools.map((tool) => {
              console.log('tool', tool);
              return (
                <div
                  key={tool.uniqueName}
                  draggable={false}
                  className="flex flex-col items-center p-4 bg-gray-900 border border-transparent hover:border-green-500 rounded-lg transition-all duration-200"
                >
                  <div
                    draggable={false}
                    className="w-full py-2 bg-[#1a1a1a] rounded cursor-pointer text-center text-gray-200 font-semibold"
                  >
                    {tool.name || tool.uniqueName}
                  </div>
                  <div
                    draggable={false}
                    className="mt-3 text-gray-400 text-sm text-center"
                  >
                    {tool.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drop Zone for adding tools to agent abilities */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleToolDrop}
          className="border-2 border-dashed border-gray-500 rounded-lg p-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 transition-colors duration-200"
        >
          <p className="text-gray-400 text-center text-lg">
            Drag & drop a tool here to add it to this agent
          </p>
        </div>

        {/* Available Tools List */}
        <div className="mt-4">
          <h3 className="text-gray-200 text-lg font-semibold mb-2">
            Abilities to add
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {habilisServerTools.map((tool) => {
              return (
                <div
                  key={tool.uniqueName}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData(
                      'application/json',
                      JSON.stringify(tool),
                    )
                  }
                  className="flex flex-col items-center p-4 bg-gray-900 border border-transparent hover:border-green-500 rounded-lg transition-all duration-200"
                >
                  <div
                    draggable={false}
                    className="w-full py-2 bg-[#1a1a1a] rounded cursor-pointer text-center text-gray-200 font-semibold"
                  >
                    {tool.name || tool.uniqueName}
                  </div>
                  <div
                    draggable={false}
                    className="mt-3 text-gray-400 text-sm text-center"
                  >
                    {tool.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentDetails;
