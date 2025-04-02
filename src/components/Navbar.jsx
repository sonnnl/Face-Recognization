import React from "react";
import { Link } from "react-router-dom";
import {
  HomeIcon,
  UserGroupIcon,
  UserPlusIcon,
} from "@heroicons/react/24/solid";

function Navbar() {
  return (
    <nav className="bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-gray-800">
              Face Attendance
            </Link>
          </div>
          <div className="flex space-x-4">
            <Link
              to="/"
              className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
            >
              <HomeIcon className="h-5 w-5 mr-2" />
              Dashboard
            </Link>
            <Link
              to="/attendance"
              className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
            >
              <UserGroupIcon className="h-5 w-5 mr-2" />
              Attendance
            </Link>
            <Link
              to="/register"
              className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
            >
              <UserPlusIcon className="h-5 w-5 mr-2" />
              Register
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
