import { useState } from "react";
import { useAuth } from "../context/authContext";
import { useNavigate } from "react-router-dom";
import { Alert } from "./Alert";
import logoImage from "../../src/assets/images/logo_class.png"; 
import { Link } from 'react-router-dom';
import "../App.css"; 

//------------
//import Image from "next/image"
//import Link from "next/link"
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

export default function Login (){
    const [user, setUser] = useState ({
        email: "",
        password: "",
    });

    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState("");

    const handleChange = ({target: {name, value}}) => 
        setUser({...user, [name]: value})

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        try {
            await login( user.email, user.password );
            navigate("/home");
        } catch (error) {
            setError(error.message);
        }
      };
    
    const handleGoogleSingIn = async () => {
        try {
            await loginWithGoogle();
            navigate("/home");
        } catch (error) {
            setError(error.message);
        }
    }      

    return (
        <div className="pagina_login" >
        <Card className="mx-auto max-w-sm " >
            {error && <Alert message={error} />}

            {<div className="flex justify-center"> 
                <img src={logoImage} alt="logo" /> 
            </div>}
            <CardHeader>
                {/*<CardTitle className="text-2xl">Login</CardTitle>*/}
            </CardHeader>

            <form onSubmit={handleSubmit}>
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
                            <Button type="submit" className="w-full">Login</Button>
                            <Button onClick={handleGoogleSingIn} variant="outline" className="w-full">Login with Google</Button>

                        <div style={{ textAlign: 'center' }}>  
                            <Link to="/register" style={{ textDecoration: 'none', color: 'black' }}>
                                No tienes una cuenta? <span style={{ textDecoration: 'underline', color: 'blue' }}>Registrate</span>
                            </Link>
                        </div>    
                    </div> 
                </CardContent>
            </form>
       </Card>
       </div>
    )
}
