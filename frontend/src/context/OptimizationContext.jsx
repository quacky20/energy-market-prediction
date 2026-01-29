import React, { createContext, useState } from 'react';

export const OptimizationContext = createContext();

export function OptimizationProvider({ children }) {
  const [optimizationData, setOptimizationData] = useState(null);
  const [optimizationComplete, setOptimizationComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <OptimizationContext.Provider
      value={{
        optimizationData,
        setOptimizationData,
        optimizationComplete,
        setOptimizationComplete,
        loading,
        setLoading
      }}
    >
      {children}
    </OptimizationContext.Provider>
  );
}