import type { Metadata } from "next";
import "./globals.css";
import AnalyticsBeacon from "@/components/analytics-beacon";

export const metadata:Metadata={
  title:"Trend-Zee — Discover What's Next",
  description:"Premium everyday fashion, accessories and footwear with an editorial shopping experience.",
  applicationName:"Trend-Zee",
  keywords:["Trend-Zee","fashion","clothing","bags","shoes","online shopping","India"],
  metadataBase:new URL("https://trend-zee.vercel.app"),
  alternates:{canonical:"/"},
  openGraph:{title:"Trend-Zee — Discover What's Next",description:"Discover the next chapter of your everyday edit.",url:"https://trend-zee.vercel.app/",siteName:"Trend-Zee",type:"website"},
  twitter:{card:"summary_large_image",title:"Trend-Zee — Discover What's Next",description:"Discover the next chapter of your everyday edit."},
  icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"},
};

const organization={"@context":"https://schema.org","@type":"Organization","name":"Trend-Zee","url":"https://trend-zee.vercel.app/","logo":"https://trend-zee.vercel.app/favicon.svg"};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body className="antialiased"><AnalyticsBeacon/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(organization)}}/>{children}</body></html>;
}
