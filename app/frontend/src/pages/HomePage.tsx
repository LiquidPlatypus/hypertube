import React from "react";
import Thumbnail from "../components/ui/Thumbnail.tsx";
import styles from "./HomePage.module.css";
import testThumbnail from "/assets/elementor-placeholder-image.png";

const thumbnailsTest = Array.from({ length: 35 }, (_, i) => ({
  src: testThumbnail,
  title: `Film ${i + 1}`,
  year: 2000 + (i % 20),
  rating: (60 + Math.random() * 3).toFixed(0),
}));

export default function HomePage() {
  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {thumbnailsTest.map((thumb, index) => (
          <div key={index} className={styles.gridItem}>
            <Thumbnail
              thumbnailSrc={thumb.src}
              thumbnailAlt={`Thumbnail ${index + 1}`}
              title={thumb.title}
              year={thumb.year}
              rating={thumb.rating}
            />
          </div>
        ))}
      </div>
    </div>
  );
}


