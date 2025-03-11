import { useState, useEffect } from 'react';
import { useAgents } from '../context/AgentContext';
import {
  GET_CONTEXT_FROM_QUERY_TOOL_NAME,
  INSERT_KNOWLEDGE_TOOL_NAME,
} from '@elite-agents/machina-habilis';

const AgentDetails = () => {
  const { selectedAgent, updateAgent, habilisServerTools } = useAgents();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [tempName, setTempName] = useState(selectedAgent?.name || '');
  const [tempDesc, setTempDesc] = useState(selectedAgent?.description || '');
  const [isDragging, setIsDragging] = useState(false);
  const [showHttpForm, setShowHttpForm] = useState(false);
  const [httpAbility, setHttpAbility] = useState({
    creator: '',
    name: '',
    description: '',
    method: 'GET',
    url: '',
    pathParams: {},
    queryParams: {},
    body: {},
    headers: {},
    transformFn: 'return response.data',
    paramDescriptions: {},
  });

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
    const toolUniqueName = e.dataTransfer.getData('text/plain');
    const tool = habilisServerTools.get(toolUniqueName);

    if (tool && selectedAgent) {
      selectedAgent.machinaInstance?.learnAbility(tool);
      updateAgent(selectedAgent.id, {
        machinaInstance: selectedAgent.machinaInstance,
      });
    }
    setIsDragging(false);
  };

  const handleHttpFormSubmit = (e) => {
    e.preventDefault();

    // Create the new HTTP wrapper ability
    const newTool = {
      uniqueName: `http-${httpAbility.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: httpAbility.name,
      description: httpAbility.description,
      httpConfig: {
        method: httpAbility.method,
        url: httpAbility.url,
        pathParams: httpAbility.pathParams,
        queryParams: httpAbility.queryParams,
        body: httpAbility.body,
        headers: httpAbility.headers,
        paramDescriptions: httpAbility.paramDescriptions,
      },
      transformFn: new Function('response', httpAbility.transformFn),
    };

    // Submit the payload to the wrapped http server
    fetch(`http://localhost:3004/create-tool`, {
      method: 'POST',
      body: JSON.stringify(newTool),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        // Reset form and close modal
        setHttpAbility({
          creator: '',
          name: '',
          description: '',
          method: 'GET',
          url: '',
          pathParams: {},
          queryParams: {},
          body: {},
          headers: {},
          transformFn: 'return response.data',
          paramDescriptions: {},
        });
        setShowHttpForm(false);
      });
  };

  const handleJsonChange = (field, e) => {
    try {
      const parsedObj = JSON.parse(e.target.value);
      setHttpAbility({ ...httpAbility, [field]: parsedObj });
    } catch (error) {
      console.error(`Invalid JSON format for ${field}`);
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
            {Array.from(
              selectedAgent?.machinaInstance?.abilityMap.entries() ?? [],
            ).map(([key, tool]) => {
              return (
                <div
                  key={key}
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

        {/* Always render drop zone but control visibility */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleToolDrop}
          className={`border-2 border-dashed border-gray-500 rounded-lg flex items-center justify-center bg-gray-800 transition-all duration-200 ${
            selectedAgent?.machinaInstance?.abilityMap.size === 0 || isDragging
              ? 'opacity-100 pointer-events-auto p-8 h-auto my-4'
              : 'opacity-0 pointer-events-none h-0 p-0 my-0 overflow-hidden'
          }`}
        >
          <p className="text-gray-400 text-center text-lg">
            Drag & drop a tool here to add it to this agent
          </p>
        </div>

        {/* Available Tools List */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-gray-200 text-lg font-semibold">
              Abilities Available to Learn
            </h3>
            <button
              onClick={() => setShowHttpForm(true)}
              className="bg-green-500 hover:bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center"
            >
              +
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {Array.from(habilisServerTools.entries())
              .filter(
                ([key, tool]) =>
                  !selectedAgent?.machinaInstance?.abilityMap.has(key) &&
                  ![
                    GET_CONTEXT_FROM_QUERY_TOOL_NAME,
                    INSERT_KNOWLEDGE_TOOL_NAME,
                  ].includes(tool.name),
              )
              .map(([key, tool]) => (
                <div
                  key={key}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', key);
                    setIsDragging(true);
                  }}
                  onDragEnd={() => setIsDragging(false)}
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
              ))}
          </div>
        </div>
      </div>

      {/* HTTP Wrapper Ability Form Modal */}
      {showHttpForm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-2xl max-h-[50vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-200">
                Create Ability by Wrapping an API
              </h2>
              <button
                onClick={() => setShowHttpForm(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form
              id="http-ability-form"
              onSubmit={handleHttpFormSubmit}
              className="space-y-4 overflow-y-auto flex-1 pr-2"
            >
              <div>
                <label className="block text-gray-300 mb-1">Ability Name</label>
                <input
                  type="text"
                  value={httpAbility.name}
                  onChange={(e) =>
                    setHttpAbility({ ...httpAbility, name: e.target.value })
                  }
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded py-2 px-3 text-gray-200"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">
                  Ability Description
                </label>
                <input
                  type="text"
                  value={httpAbility.description}
                  onChange={(e) =>
                    setHttpAbility({
                      ...httpAbility,
                      description: e.target.value,
                    })
                  }
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded py-2 px-3 text-gray-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-1">Method</label>
                  <select
                    value={httpAbility.method}
                    onChange={(e) =>
                      setHttpAbility({ ...httpAbility, method: e.target.value })
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded py-2 px-3 text-gray-200"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 mb-1">URL</label>
                  <input
                    type="text"
                    value={httpAbility.url}
                    onChange={(e) =>
                      setHttpAbility({ ...httpAbility, url: e.target.value })
                    }
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded py-2 px-3 text-gray-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">
                  Path Parameters (JSON format)
                </label>
                <textarea
                  value={JSON.stringify(httpAbility.pathParams, null, 2)}
                  onChange={(e) => handleJsonChange('pathParams', e)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded py-2 px-3 text-gray-200 font-mono text-sm"
                  placeholder={`{"userId": "string", "postId": "number"}`}
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">
                  Query Parameters (JSON format)
                </label>
                <textarea
                  value={JSON.stringify(httpAbility.queryParams, null, 2)}
                  onChange={(e) => handleJsonChange('queryParams', e)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded py-2 px-3 text-gray-200 font-mono text-sm"
                  placeholder={`{"page": "number", "limit": "number"}`}
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">
                  Body (JSON format)
                </label>
                <textarea
                  value={JSON.stringify(httpAbility.body, null, 2)}
                  onChange={(e) => handleJsonChange('body', e)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded py-2 px-3 text-gray-200 font-mono text-sm"
                  placeholder={`{"name": {"type": "string"}, "age": {"type": "number"}}`}
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">
                  Headers (JSON format)
                </label>
                <textarea
                  value={JSON.stringify(httpAbility.headers, null, 2)}
                  onChange={(e) => handleJsonChange('headers', e)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded py-2 px-3 text-gray-200 font-mono text-sm"
                  placeholder={`{"Content-Type": "application/json", "Authorization": "Bearer token"}`}
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">
                  Parameter Descriptions (JSON format)
                </label>
                <textarea
                  value={JSON.stringify(httpAbility.paramDescriptions, null, 2)}
                  onChange={(e) => handleJsonChange('paramDescriptions', e)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded py-2 px-3 text-gray-200 font-mono text-sm"
                  placeholder={`{"userId": "The user's unique identifier", "postId": "The post's unique identifier"}`}
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">
                  Transform Function
                </label>
                <textarea
                  value={httpAbility.transformFn}
                  onChange={(e) =>
                    setHttpAbility({
                      ...httpAbility,
                      transformFn: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded py-2 px-3 text-gray-200 font-mono text-sm"
                />
              </div>
            </form>

            <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-gray-700">
              <button
                type="button"
                onClick={() => setShowHttpForm(false)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-4 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="http-ability-form"
                className="bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded"
              >
                Create Ability
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDetails;
