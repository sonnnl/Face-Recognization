import React, { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

function Dashboard() {
  const [stats, setStats] = useState({
    totalAttendees: 0,
    presentToday: 0,
    attendanceRate: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch attendance data
      const attendanceQuery = query(collection(db, "attendance"));
      const attendanceSnapshot = await getDocs(attendanceQuery);

      // Fetch recent activity
      const activityQuery = query(
        collection(db, "attendance"),
        orderBy("timestamp", "desc"),
        limit(5)
      );
      const activitySnapshot = await getDocs(activityQuery);

      // Calculate statistics
      const today = new Date().toISOString().split("T")[0];
      const totalAttendees = attendanceSnapshot.size;
      const presentToday = attendanceSnapshot.docs.filter(
        (doc) => doc.data().date === today
      ).length;

      setStats({
        totalAttendees,
        presentToday,
        attendanceRate:
          totalAttendees > 0 ? (presentToday / totalAttendees) * 100 : 0,
      });

      // Set recent activity
      setRecentActivity(
        activitySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <UserGroupIcon className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-500">Total Attendees</p>
              <p className="text-2xl font-semibold">{stats.totalAttendees}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircleIcon className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-500">Present Today</p>
              <p className="text-2xl font-semibold">{stats.presentToday}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <ClockIcon className="h-8 w-8 text-yellow-500" />
            <div className="ml-4">
              <p className="text-sm text-gray-500">Attendance Rate</p>
              <p className="text-2xl font-semibold">
                {stats.attendanceRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between border-b pb-4"
              >
                <div>
                  <p className="font-medium">{activity.name}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(activity.timestamp?.toDate()).toLocaleString()}
                  </p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  Present
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
