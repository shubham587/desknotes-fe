import { useEffect, useState } from "react";
import { Center, Loader } from "@mantine/core";
import { api, getToken, clearToken } from "./api";
import Login from "./Login.jsx";
import Shell from "./Shell.jsx";

export default function App() {
  const [state, setState] = useState("loading"); // loading | out | in

  useEffect(() => {
    if (!getToken()) return setState("out");
    api
      .me()
      .then(() => setState("in"))
      .catch(() => {
        clearToken();
        setState("out");
      });
  }, []);

  if (state === "loading")
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  if (state === "out") return <Login onLogin={() => setState("in")} />;
  return <Shell onLogout={() => setState("out")} />;
}
