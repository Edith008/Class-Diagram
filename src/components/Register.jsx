import {useState} from "react";
import {useAuth} from "../context/authContext";
import { useNavigate } from "react-router-dom";
import { Alert } from "./Alert";
import { Link } from 'react-router-dom';

//------------
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"
//----------

export default function Register(){
    const [user, setUser] = useState ({
        email: "",
        password: "",
    });
    
    const {singUp} = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState();

    const handleChange = ({target: {name, value}}) => 
        setUser({...user, [name]: value})

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        try {
            await singUp( user.email, user.password )
            navigate("/home");
        } catch (error) {
            setError(error.message);
            
        }
    };

    return ( 
        <div className="pagina_register" > 
        <Card className="mx-auto max-w-sm">
            {error && <Alert message={error} />}
            <CardHeader>
                <CardTitle className="text-2xl"> Registro </CardTitle>
                <CardDescription>
                Ingrese su correo electrónico y email, para crear una cuenta
                </CardDescription>
            </CardHeader>
            
            <form  onSubmit={handleSubmit}>
            <CardContent> 
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" name="email" placeholder="m@example.com" onChange={handleChange}/>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" name="password" placeholder="*******" onChange={handleChange}/>
                    </div>
                    <Button type="submit" className="w-full">Registarse</Button>

                    <div style={{ textAlign: 'center' }}>  
                        <Link to="/login" style={{ textDecoration: 'none', color: 'black' }}>
                            Ya tienes una cuenta? <span style={{ textDecoration: 'underline', color: 'blue' }}>Inicia sesión</span>
                        </Link>
                    </div>
                </div>
            </CardContent>
            </form>
        </Card>   
        </div>   

    )
}
