import { createContext, useContext, useState } from "react";
const WalletContext = createContext<any>(undefined); 
export const WalletProvider = ({ children }: any) => { 
  const [balance, setBalance] = useState(0); 
  return <WalletContext.Provider value={{balance, setBalance}}>{children}</WalletContext.Provider>; 
};
export const useWallet = () => useContext(WalletContext);
