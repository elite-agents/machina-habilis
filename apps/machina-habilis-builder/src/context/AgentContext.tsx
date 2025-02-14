import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  HabilisServer,
  MachinaAgent,
  OldowanToolDefinition,
  type IMachinaAgentOpts,
} from '@elite-agents/machina-habilis';
import { Keypair } from '@solana/web3.js';

interface Agent {
  id: number;
  name: string;
  description: string;
  image: string;
  persona: {
    name: string;
    description: string;
    bio: string[];
  };
  machinaInstance?: MachinaAgent;
  keypair?: Keypair;
}

interface AgentContextType {
  agents: Agent[];
  selectedAgent: Agent | null;
  setSelectedAgent: (agent: Agent | null) => void;
  createAgent: (name: string) => Promise<void>;
  updateAgent: (id: number, updates: Partial<Agent>) => void;
  habilisServerTools: OldowanToolDefinition[];
}

const AgentContext = createContext<AgentContextType>({
  agents: [],
  selectedAgent: null,
  setSelectedAgent: () => {},
  createAgent: async () => {},
  updateAgent: () => {},
  habilisServerTools: [],
});

interface AgentProviderProps {
  children: ReactNode;
}

const habilisServer = new HabilisServer('http://localhost:3002/sse');

const createMachinaInstance = (agent: Partial<Agent>): MachinaAgent => {
  return new MachinaAgent(habilisServer, {
    ...agent,
    abilityNames: ['create_agent'],
    llm: {
      name: 'gpt-4o-mini',
      provider: 'openai',
      apiKey:
        'sk-genopets-api-awaCHqoYAi6txZVHi5u9T3BlbkFJz6h7ZfQNAjxcSFDgrHov',
    },
    keypair: agent?.keypair || new Keypair(),
  } as unknown as IMachinaAgentOpts);
};

export function AgentProvider({ children }: AgentProviderProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [habilisServerTools, setHabilisServerTools] = useState<
    OldowanToolDefinition[]
  >([]);

  useEffect(() => {
    async function init() {
      await habilisServer.init(['http://localhost:3003/sse']);
      setHabilisServerTools(Array.from(habilisServer.toolsMap.values()));
    }
    init();
  }, []);

  // Load agents and selected agent from localStorage on mount
  useEffect(() => {
    const storedAgents = localStorage.getItem('agents');
    const storedSelectedAgentId = localStorage.getItem('selectedAgentId');

    if (storedAgents) {
      const parsedAgents: Agent[] = JSON.parse(storedAgents);
      const newInstanceAgents: Agent[] = parsedAgents.map((agent: Agent) => ({
        ...agent,
        machinaInstance: createMachinaInstance(agent) as MachinaAgent,
      }));
      setAgents(newInstanceAgents);

      if (storedSelectedAgentId) {
        const selectedAgent = newInstanceAgents.find(
          (agent) => agent.id === Number(storedSelectedAgentId),
        );
        if (selectedAgent) {
          setSelectedAgent(selectedAgent);
        }
      }
    }
  }, []);

  // Save agents and selected agent to localStorage whenever they change
  useEffect(() => {
    if (agents.length > 0) {
      localStorage.setItem('agents', JSON.stringify(agents));
    }
    if (selectedAgent) {
      localStorage.setItem('selectedAgentId', selectedAgent.id.toString());
    }
  }, [agents, selectedAgent]);

  const createAgent = async (name: string) => {
    const newAgent: Agent = {
      id: Date.now(),
      name,
      description: '',
      image: 'G',
      persona: {
        name,
        description: 'a new one',
        bio: [],
      },
    };

    newAgent.machinaInstance = createMachinaInstance(newAgent);

    setAgents([...agents, newAgent]);
    setSelectedAgent(newAgent);
  };

  const updateAgent = (id: number, updates: Partial<Agent>) => {
    const updatedAgents = agents.map((agent) =>
      agent.id === id ? { ...agent, ...updates } : agent,
    );
    setAgents(updatedAgents);
    if (selectedAgent?.id === id) {
      setSelectedAgent({ ...selectedAgent, ...updates });
    }
  };

  return (
    <AgentContext.Provider
      value={{
        agents,
        selectedAgent,
        setSelectedAgent,
        createAgent,
        updateAgent,
        habilisServerTools,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export const useAgents = () => useContext(AgentContext);
