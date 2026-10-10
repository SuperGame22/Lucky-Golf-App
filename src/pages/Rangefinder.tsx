import { Navigate } from "react-router-dom";

// The Rangefinder is the AR Monocle. The old page here showed made-up yardages, so it now goes straight in
// (this also covers the old ?ar=true links).
const Rangefinder = () => <Navigate to="/monocle" replace />;

export default Rangefinder;
