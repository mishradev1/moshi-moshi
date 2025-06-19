import { useSearchParams } from "react-router-dom";

export const Room = () => {
    const [searchParams] = useSearchParams();
    const name = searchParams.get("name") || "Guest";
    
    return <div>
        {name} joined the Room
    </div>
}