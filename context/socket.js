import { createContext, useEffect, useState } from 'react';
import {io} from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => {
    const socket = useContext(SocketContext);
    return socket;
}

export const SocketProvider = ({children}) => {
    const [socket,setSocket] = useState(null);

    useEffect(()=>{
        const connection = io()
        console.log("Socket connected", connection);
        setSocket(connection);
    }, [])

    socket?.on('connect_error', async (err) => {
        console.log("error establishing socket", err);
        await fetch('/api/socket')
    } )

    return(
    <SocketContext.Provider value={socket}>
        {children}
    </SocketContext.Provider>
    )
}