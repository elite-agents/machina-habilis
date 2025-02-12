import React from 'react'

const navItems = [
  { icon: "G", label: "Habilis", type: "logo" },
]

const Sidebar = () => {
  return (
    <div className="fixed left-0 top-0 h-screen w-56 bg-[#1a1a1a] text-gray-300 p-4">
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
      
      <div className="mt-8 border-t border-gray-800 pt-4">
        <h3 className="text-sm text-gray-500 mb-4">Agents</h3>
        <button className="flex items-center space-x-2 text-green-500 hover:bg-gray-800 p-2 rounded w-full">
          <span>+</span>
          <span>Create</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar 