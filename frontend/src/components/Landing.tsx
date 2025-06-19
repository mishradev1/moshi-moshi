import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const Landing = () => {
    const [name, setName] = useState("");
    const navigate = useNavigate();
    
    const handleJoin = () => {
        if (name.trim()) {
            navigate(`/room?name=${encodeURIComponent(name)}`);
        }
    };
    
    return <div className="">
        <input 
            type="text" 
            placeholder="Enter your name"
            value={name}
            onChange={(e) => {
                setName(e.target.value);
            }}
        />
        <button onClick={handleJoin}>Join</button>
    </div>
}