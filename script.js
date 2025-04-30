document.addEventListener("DOMContentLoaded", () => {
  // --- Tab Navigation Elements ---
  const tabs = document.querySelectorAll(".skill-tabs .tab-item");
  const tabContents = document.querySelectorAll(".skill-tree-content");
  const tabOrder = Array.from(tabs).map((tab) => tab.dataset.tabId);

  // --- Game State Variables ---
  const availablePointsEl = document.getElementById("available-points");
  let availablePoints = parseInt(availablePointsEl.textContent);
  let activeTabIndex = 0;

  // Store the references to the delegated listener functions
  let currentTreeClickListener = null;
  let currentTreeContextMenuListener = null; // Listener for right-click

  // Declare a global array of common nodes that can be accessed from multiple paths
  const commonNodeIds = ["c1-g"]; // Add any other common nodes as needed

  const cursorFollower = document.createElement("div");
  cursorFollower.classList.add("cursor-follower");
  document.body.appendChild(cursorFollower);

  // Update cursor follower position smoothly with requestAnimationFrame
  let mouseX = 0,
    mouseY = 0;
  let cursorX = 0,
    cursorY = 0;

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Check if element is clickable and update cursor accordingly
  document.addEventListener("mouseover", (e) => {
    const target = e.target;
    if (
      target.classList.contains("skill-node") &&
      !target.classList.contains("locked") &&
      !target.classList.contains("path-locked")
    ) {
      cursorFollower.classList.add("active");
    } else if (
      target.tagName === "BUTTON" ||
      target.classList.contains("tab-item") ||
      target.tagName === "A"
    ) {
      cursorFollower.classList.add("active");
    } else {
      cursorFollower.classList.remove("active");
    }
  });

  const resetAllBtn = document.getElementById("reset-all-points");

  resetAllBtn.addEventListener("click", () => {
    // Ask for confirmation before resetting
    if (
      !confirm(
        "Are you sure you want to reset all skill points? This will clear your entire skill tree."
      )
    ) {
      return;
    }

    // Get ALL nodes (not just from active tree)
    const allTreeNodes = document.querySelectorAll(".skill-node");

    // Track how many points we're returning
    let totalPointsRefunded = 0;

    // Reset each node
    allTreeNodes.forEach((node) => {
      const currentPoints = parseInt(node.dataset.currentPoints);
      if (currentPoints > 0) {
        totalPointsRefunded += currentPoints;
        node.dataset.currentPoints = 0;
      }

      // IMPORTANT: Remove all lock classes regardless of points
      node.classList.remove("path-locked");

      // Also reset any other state classes that might cause issues
      node.classList.remove("invested", "maxed");

      // Make sure all nodes are either available or locked based on their prerequisites
      if (node.dataset.prereq === undefined || node.dataset.prereq === "") {
        // Root nodes should be available
        node.classList.remove("locked");
        node.classList.add("available");
      } else {
        // Non-root nodes should initially be locked
        node.classList.remove("available");
        node.classList.add("locked");
      }
    });

    // Update available points
    availablePoints += totalPointsRefunded;
    availablePointsDisplay.textContent = availablePoints;
    pointsInput.value = availablePoints;

    // Update node states and point counters
    updateNodeStates();
    updatePointCounters();

    // Redraw lines immediately
    drawAllLines();

    // Confirmation message
    const confirmMsg = document.createElement("span");
    confirmMsg.textContent = `✓ Reset complete! Refunded ${totalPointsRefunded} points.`;
    confirmMsg.classList.add("reset-confirmed-msg");
    confirmMsg.style.color = "#ff9";
    confirmMsg.style.marginLeft = "10px";
    confirmMsg.style.fontSize = "0.9em";
    resetAllBtn.parentNode.appendChild(confirmMsg);

    // Log the action
    console.log(
      `Reset all skills, refunded ${totalPointsRefunded} points. New total: ${availablePoints}`
    );

    // Remove the confirmation message after a short delay
    setTimeout(() => {
      confirmMsg.remove();
    }, 2500);
  });

  // Animation loop for smooth cursor following
  function updateCursor() {
    // Smoothly interpolate cursor position (easing effect)
    const easing = 0.2;
    cursorX += (mouseX - cursorX) * easing;
    cursorY += (mouseY - cursorY) * easing;

    cursorFollower.style.left = `${cursorX}px`;
    cursorFollower.style.top = `${cursorY}px`;

    // Continue animation loop
    requestAnimationFrame(updateCursor);
  }

  // Start the cursor animation
  updateCursor();

  // Hide default cursor
  document.body.style.cursor = "none";

  // --- Initialization ---
  console.log("Initializing Skill Tree...");
  setupInitialActiveTree(); // Initial setup

  // --- Event Listeners ---
  document.addEventListener("keydown", handleKeyPress);
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => setActiveTab(index));
  });
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(drawAllLines, 150);
  });

  // --- Functions ---

  function handleKeyPress(event) {
    let newIndex = activeTabIndex;
    if (event.key === "q" || event.key === "Q") {
      newIndex = (activeTabIndex - 1 + tabOrder.length) % tabOrder.length;
    } else if (event.key === "e" || event.key === "E") {
      newIndex = (activeTabIndex + 1) % tabOrder.length;
    }
    if (newIndex !== activeTabIndex) setActiveTab(newIndex);
  }

  function setActiveTab(index) {
    if (index < 0 || index >= tabOrder.length || index === activeTabIndex)
      return;
    console.log(`Switching tab from ${activeTabIndex} to ${index}`);

    // --- Remove Listeners from OLD active tree ---
    const oldActiveTreeContent = tabContents[activeTabIndex];
    if (oldActiveTreeContent) {
      if (currentTreeClickListener) {
        oldActiveTreeContent.removeEventListener(
          "click",
          currentTreeClickListener
        );
        console.log(`Removed click listener from tree ${activeTabIndex}`);
      }
      if (currentTreeContextMenuListener) {
        oldActiveTreeContent.removeEventListener(
          "contextmenu",
          currentTreeContextMenuListener
        );
        console.log(`Removed contextmenu listener from tree ${activeTabIndex}`);
      }
    }

    // Deactivate current visual state
    tabs[activeTabIndex]
      .closest(".tab-item-wrapper")
      .querySelector(".tab-item")
      .classList.remove("active");
    oldActiveTreeContent?.classList.remove("active"); // Use optional chaining

    // Activate new
    activeTabIndex = index;
    const newActiveTreeContent = tabContents[activeTabIndex];
    tabs[activeTabIndex]
      .closest(".tab-item-wrapper")
      .querySelector(".tab-item")
      .classList.add("active");
    newActiveTreeContent?.classList.add("active"); // Use optional chaining

    // --- Setup for NEW active tree ---
    if (newActiveTreeContent) {
      setupActiveTree(newActiveTreeContent);
    } else {
      console.error(`Content for tab index ${index} not found!`);
    }

    // Make sure we update the point counters and redraw lines
    updatePointCounters();

    // Force redraw lines with a slight delay to ensure DOM is updated
    setTimeout(() => {
      drawAllLines();
    }, 50);
  }

  function setupInitialActiveTree() {
    const initialTreeContent = tabContents[activeTabIndex];
    if (initialTreeContent) {
      setupActiveTree(initialTreeContent);
    } else {
      console.error("Initial active tree content not found!");
    }
  }

  function setupActiveTree(activeTreeElement) {
    console.log(`Setting up tree: ${activeTreeElement.id}`);

    // --- Attach Delegated Click Listener ---
    currentTreeClickListener = function (event) {
      const clickedNode = event.target.closest(".skill-node");
      if (clickedNode) {
        console.log(`Node left-clicked: ${clickedNode.id}`);
        handleSkillLearn(clickedNode); // Call the learn logic
      }
    };
    activeTreeElement.addEventListener("click", currentTreeClickListener);
    console.log(`Added click listener to tree ${activeTreeElement.id}`);

    // --- Attach Delegated Context Menu (Right-Click) Listener ---
    currentTreeContextMenuListener = function (event) {
      const clickedNode = event.target.closest(".skill-node");
      if (clickedNode) {
        event.preventDefault(); // Prevent default right-click menu
        console.log(`Node right-clicked: ${clickedNode.id}`);
        handleSkillRemove(clickedNode); // Call the remove logic
      }
    };
    activeTreeElement.addEventListener(
      "contextmenu",
      currentTreeContextMenuListener
    );
    console.log(`Added contextmenu listener to tree ${activeTreeElement.id}`);

    // Initial state update and line drawing for this tree
    updateNodeStates();
    requestAnimationFrame(drawAllLines); // Use rAF for initial draw
  }

  // Update the lockAlternativePaths function to exclude common paths
  function lockAlternativePaths(node) {
    // Find all parents that list this node as a child
    const allNodeIds = Array.from(document.querySelectorAll(".skill-node")).map(
      (node) => node.id
    );

    for (const potentialParentId of allNodeIds) {
      const potentialParent = document.getElementById(potentialParentId);
      if (!potentialParent) continue;

      const childrenIds = potentialParent.dataset.children?.split(",");
      if (!childrenIds || childrenIds[0] === "") continue;

      // Clean up the children IDs and check if our node is included
      const trimmedChildrenIds = childrenIds.map((id) => id.trim());
      if (!trimmedChildrenIds.includes(node.id)) continue;

      // If this parent has multiple children AND node has points invested
      if (
        trimmedChildrenIds.length > 1 &&
        parseInt(node.dataset.currentPoints) > 0
      ) {
        // Lock all other sibling nodes
        for (const siblingId of trimmedChildrenIds) {
          if (siblingId === node.id) continue; // Skip the node we're investing in

          const siblingNode = document.getElementById(siblingId);
          if (siblingNode) {
            console.log(
              `Locking alternative path node ${siblingNode.id} (sibling to ${node.id})`
            );
            siblingNode.classList.add("path-locked");

            // Lock descendants, but respect common nodes (like 'swift-attack-g')
            lockDescendantsExceptCommon(siblingNode);
          }
        }
      }
    }
  }

  // Update lockDescendantsExceptCommon function to be more permissive with common nodes
  function lockDescendantsExceptCommon(node) {
    // Skip locking if this is a common node
    if (commonNodeIds.includes(node.id)) {
      console.log(`Skipping lock on common node: ${node.id}`);
      return;
    }

    // Lock this node
    node.classList.add("path-locked");
    console.log(`Path-locking node: ${node.id}`);

    // Get all children of this node
    const childrenIds = node.dataset.children?.split(",");
    if (!childrenIds || childrenIds[0] === "") return;

    // Recursively lock non-common children
    childrenIds.forEach((childId) => {
      const childNode = document.getElementById(childId.trim());
      if (childNode) {
        // Check if this child is a common node before locking
        if (!commonNodeIds.includes(childNode.id)) {
          lockDescendantsExceptCommon(childNode);
        } else {
          console.log(
            `Found common node during locking: ${childNode.id} - keeping accessible`
          );
        }
      }
    });
  }

  // Update checkPrerequisites to correctly handle common nodes
  function checkPrerequisites(node) {
    // Special handling for common nodes
    if (commonNodeIds.includes(node.id)) {
      console.log(`Checking prereqs for common node: ${node.id}`);
      const prereqIds = node.dataset.prereq?.split(",");
      if (!prereqIds || prereqIds[0] === "") return true; // No prerequisites

      // For common nodes, ANY prerequisite with points satisfies the requirement
      const anyPrereqMet = prereqIds.some((prereqId) => {
        const prereqNode = document.getElementById(prereqId.trim());
        const hasPoints =
          prereqNode && parseInt(prereqNode.dataset.currentPoints) > 0;
        if (hasPoints) {
          console.log(
            `Common node ${node.id} - prereq ${prereqNode.id} is met with points`
          );
        }
        return hasPoints;
      });

      return anyPrereqMet;
    }

    // For regular nodes, check if path-locked first
    if (node.classList.contains("path-locked")) {
      return false;
    }

    // Regular prerequisite check
    const prereqIds = node.dataset.prereq?.split(",");
    if (!prereqIds || prereqIds[0] === "") return true; // No prerequisites

    // Using .some() - at least ONE prerequisite must be met
    const met = prereqIds.some((prereqId) => {
      const prereqNode = document.getElementById(prereqId.trim());
      return prereqNode && parseInt(prereqNode.dataset.currentPoints) > 0;
    });

    return met;
  }

  // Update the function that handles node selection to respect common nodes
  function wouldViolateSinglePathRule(node) {
    // Common nodes never violate the single-path rule
    if (commonNodeIds.includes(node.id)) {
      return false;
    }

    // Standard path violation check for non-common nodes
    const allNodeIds = Array.from(document.querySelectorAll(".skill-node")).map(
      (node) => node.id
    );

    for (const potentialParentId of allNodeIds) {
      const potentialParent = document.getElementById(potentialParentId);
      if (!potentialParent) continue;

      const childrenIds = potentialParent.dataset.children?.split(",");
      if (!childrenIds || childrenIds[0] === "") continue;

      const trimmedChildrenIds = childrenIds.map((id) => id.trim());
      if (!trimmedChildrenIds.includes(node.id)) continue;

      if (
        trimmedChildrenIds.length > 1 &&
        parseInt(potentialParent.dataset.currentPoints) > 0
      ) {
        for (const siblingId of trimmedChildrenIds) {
          if (siblingId === node.id) continue;

          const siblingNode = document.getElementById(siblingId);
          if (siblingNode && parseInt(siblingNode.dataset.currentPoints) > 0) {
            console.log(
              `Cannot invest in ${node.id}: sibling ${siblingNode.id} already has points`
            );
            return true;
          }
        }
      }
    }

    return false;
  }

  // Replace the existing lockDescendants function with our new one
  function lockDescendants(node) {
    lockDescendantsExceptCommon(node);
  }

  // Fix handleSkillLearn to properly check and set path locking
  function handleSkillLearn(clickedNode) {
    console.log(`Handling learn for: ${clickedNode.id}`);

    // Highlight Logic
    const activeTreeContent = tabContents[activeTabIndex];
    const currentHighlighted = activeTreeContent?.querySelector(
      ".skill-node.highlighted"
    );
    if (currentHighlighted) currentHighlighted.classList.remove("highlighted");
    clickedNode.classList.add("highlighted");

    // Check if the node is available or already has points invested
    if (
      !clickedNode.classList.contains("available") &&
      !clickedNode.classList.contains("invested")
    ) {
      console.log("Skill is locked or already maxed (cannot invest more).");
      return; // Can't learn locked or maxed skills
    }

    // Check if we have points to invest
    if (availablePoints <= 0) {
      console.log("No available skill points.");
      return;
    }

    // Check if this node is path-locked
    if (clickedNode.classList.contains("path-locked")) {
      console.log("Cannot invest in a path-locked node.");
      return;
    }

    // Check if investing in this node would violate the single-path rule
    // Only check for first point investment
    if (
      parseInt(clickedNode.dataset.currentPoints) === 0 &&
      wouldViolateSinglePathRule(clickedNode)
    ) {
      console.log(
        "Cannot invest: an alternative path has already been chosen."
      );
      return;
    }

    const maxPoints = parseInt(clickedNode.dataset.maxPoints);
    let currentPoints = parseInt(clickedNode.dataset.currentPoints);

    if (currentPoints < maxPoints) {
      currentPoints++;
      availablePoints--;
      clickedNode.dataset.currentPoints = currentPoints;
      availablePointsEl.textContent = availablePoints;

      // If this is the first point in this node, lock alternative paths
      if (currentPoints === 1) {
        lockAlternativePaths(clickedNode);
      }

      updateNodeStates(); // This will trigger line redraw via timeout
      updatePointCounters(); // Update the point counters

      console.log(
        `Learned ${clickedNode.id}, level ${currentPoints}/${maxPoints}. Points left: ${availablePoints}`
      );
    } else {
      console.log(`Node ${clickedNode.id} already at max points.`);
    }
  }

  function handleSkillRemove(clickedNode) {
    console.log(`Handling remove for: ${clickedNode.id}`);
    const currentPoints = parseInt(clickedNode.dataset.currentPoints);

    if (currentPoints <= 0) {
      console.log("Skill has no points invested.");
      return;
    }

    // If node has multiple points and not the last one, just remove one point
    const maxPoints = parseInt(clickedNode.dataset.maxPoints);
    if (maxPoints > 1 && currentPoints > 1) {
      // Simply remove one point
      clickedNode.dataset.currentPoints = currentPoints - 1;
      availablePoints++;
      availablePointsEl.textContent = availablePoints;

      updateNodeStates(); // Update visual states
      updatePointCounters(); // Update the point counters

      console.log(
        `Removed 1 point from ${clickedNode.id}, now ${
          currentPoints - 1
        }/${maxPoints}`
      );
      return;
    }

    // Otherwise, handle full node removal as before
    // First check if removing this node would orphan any children
    const dependentNodes = [];
    findDependentNodes(clickedNode, dependentNodes);

    let totalPointsToReturn = currentPoints;

    // Get points from descendants
    const childrenIds = clickedNode.dataset.children?.split(",");
    if (childrenIds && childrenIds[0] !== "") {
      const pointsReturned = resetAllDescendants(clickedNode);
      totalPointsToReturn += pointsReturned;
      console.log(
        `Reset all descendants of ${clickedNode.id}, returned ${pointsReturned} points`
      );
    }

    // Now remove points from this node
    if (canRemovePoint(clickedNode, true)) {
      // First set the points to 0 - important to do this before unlocking paths
      clickedNode.dataset.currentPoints = 0;

      // Update the available points
      availablePoints += totalPointsToReturn;
      availablePointsEl.textContent = availablePoints;

      // Path unlocking code as before...
      if (
        clickedNode.dataset.prereq === undefined ||
        clickedNode.dataset.prereq === ""
      ) {
        console.log("Root node detected - performing FULL tree unlock!");
        const allNodes = Array.from(document.querySelectorAll(".skill-node"));
        allNodes.forEach((node) => {
          if (node.classList.contains("path-locked")) {
            console.log(`Force unlocking: ${node.id}`);
            node.classList.remove("path-locked");
          }
        });
      } else {
        unlockAllPathsFromParent(clickedNode);
        unlockAlternativePaths(clickedNode);
      }

      // Highlight the node
      const activeTreeContent = tabContents[activeTabIndex];
      const currentHighlighted = activeTreeContent?.querySelector(
        ".skill-node.highlighted"
      );
      if (currentHighlighted)
        currentHighlighted.classList.remove("highlighted");
      clickedNode.classList.add("highlighted");

      // Update visual states, counters and redraw lines
      updateNodeStates();
      updatePointCounters();

      console.log(
        `Removed ${totalPointsToReturn} points from ${clickedNode.id} and dependencies. Points left: ${availablePoints}`
      );
    }
  }

  function setupInitialActiveTree() {
    const initialTreeContent = tabContents[activeTabIndex];
    if (initialTreeContent) {
      setupActiveTree(initialTreeContent);
      updatePointCounters(); // Initialize point counters
    } else {
      console.error("Initial active tree content not found!");
    }
  }

  function unlockAllPathsFromParent(node) {
    console.log(
      `Attempting to unlock all paths from parent of node: ${node.id}`
    );

    // First, check if the node itself is a parent with multiple child branches
    const nodeChildrenIds = node.dataset.children?.split(",");
    if (nodeChildrenIds && nodeChildrenIds[0] !== "") {
      console.log(
        `Node ${node.id} has children, checking if we need to unlock branches...`
      );

      // If this node has NO POINTS, then ALL child paths should be unlocked
      if (parseInt(node.dataset.currentPoints) === 0) {
        console.log(
          `Node ${node.id} has no points - forcibly unlocking ALL child paths`
        );

        // Unlock ALL children branches from this node
        nodeChildrenIds.forEach((childId) => {
          const childNode = document.getElementById(childId.trim());
          if (childNode && childNode.classList.contains("path-locked")) {
            console.log(`UNLOCKING branch node: ${childNode.id}`);
            childNode.classList.remove("path-locked");
            unlockDescendantsRecursive(childNode);
          }
        });
      }
    }

    // Now check all potential parents of this node
    const allNodes = Array.from(document.querySelectorAll(".skill-node"));

    // Aggressive approach: iterate through ALL nodes and check if they might be parents
    for (const potentialParent of allNodes) {
      const childrenIds = potentialParent.dataset.children?.split(",");
      if (!childrenIds || childrenIds[0] === "") continue;

      // Check if this potential parent has our node as a child
      const trimmedChildrenIds = childrenIds.map((id) => id.trim());
      if (!trimmedChildrenIds.includes(node.id)) continue;

      console.log(
        `Found parent node ${potentialParent.id} of ${node.id}, checking branches...`
      );

      // If parent has NO POINTS, or if our node has NO POINTS, unlock ALL paths
      if (
        parseInt(potentialParent.dataset.currentPoints) === 0 ||
        parseInt(node.dataset.currentPoints) === 0
      ) {
        console.log(
          `Parent ${potentialParent.id} or child ${node.id} has no points - unlocking all branches`
        );

        // Aggressively unlock ALL sibling branches
        trimmedChildrenIds.forEach((siblingId) => {
          const siblingNode = document.getElementById(siblingId);
          if (siblingNode && siblingNode.classList.contains("path-locked")) {
            console.log(
              `UNLOCKING branch node: ${siblingNode.id} from parent ${potentialParent.id}`
            );
            siblingNode.classList.remove("path-locked");
            unlockDescendantsRecursive(siblingNode);
          }
        });
      }
    }

    // Special handling for root nodes (like A nodes in your example)
    if (node.dataset.prereq === undefined || node.dataset.prereq === "") {
      console.log(
        `Node ${node.id} is a root node, checking for branches to unlock`
      );

      // If it's a root node with no points, unlock ALL potential branches
      if (parseInt(node.dataset.currentPoints) === 0) {
        // Find all direct children and their descendants
        const childrenIds = node.dataset.children?.split(",");
        if (childrenIds && childrenIds[0] !== "") {
          console.log(
            `Root node ${node.id} has no points - unlocking ALL branches`
          );

          childrenIds.forEach((childId) => {
            const childNode = document.getElementById(childId.trim());
            if (childNode) {
              // Remove path-locked from the child
              childNode.classList.remove("path-locked");

              // And from all its descendants
              unlockDescendantsRecursive(childNode);
            }
          });
        }
      }
    }
  }

  const availablePointsDisplay = document.querySelector(
    "#available-points span"
  );
  const pointsInput = document.getElementById("available-points-input");
  const applyBtn = document.getElementById("apply-points");

  // Initialize with current value
  pointsInput.value = availablePoints;

  // Apply button updates the available points
  applyBtn.addEventListener("click", () => {
    let newPoints = parseInt(pointsInput.value);
    const oldPoints = availablePoints;

    // Check if valid number and within limits
    if (isNaN(newPoints)) {
      pointsInput.value = oldPoints;
      return;
    }

    // Enforce min/max limits
    if (newPoints < 0) {
      newPoints = 0;
      pointsInput.value = 0;
    } else if (newPoints > 350) {
      newPoints = 350;
      pointsInput.value = 350;
    }

    // Update the available points
    availablePoints = newPoints;
    availablePointsDisplay.textContent = availablePoints;

    console.log(`Updated available points: ${oldPoints} → ${availablePoints}`);

    // Optional: show a brief confirmation message
    const confirmMsg = document.createElement("span");
    confirmMsg.textContent = "✓ Updated!";
    confirmMsg.classList.add("points-updated-msg");
    confirmMsg.style.color = "#8f8";
    confirmMsg.style.marginLeft = "10px";
    confirmMsg.style.fontSize = "0.9em";
    applyBtn.parentNode.appendChild(confirmMsg);

    // Remove the confirmation message after a short delay
    setTimeout(() => {
      confirmMsg.remove();
    }, 1500);
  });

  // Allow Enter key to apply changes
  pointsInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      applyBtn.click();
    }
  });

  function unlockDescendantsRecursive(node) {
    // Forcibly remove the path-locked class
    if (node.classList.contains("path-locked")) {
      console.log(`Recursively unlocking node: ${node.id}`);
      node.classList.remove("path-locked");
    }

    // Get all children and unlock them too
    const childrenIds = node.dataset.children?.split(",");
    if (!childrenIds || childrenIds[0] === "") return;

    childrenIds.forEach((childId) => {
      const childNode = document.getElementById(childId.trim());
      if (childNode) {
        unlockDescendantsRecursive(childNode);
      }
    });
  }

  function updatePointCounters() {
    // Get all nodes that might have multiple levels
    const multiLevelNodes = document.querySelectorAll(
      ".skill-node[data-max-points]"
    );

    multiLevelNodes.forEach((node) => {
      const maxPoints = parseInt(node.dataset.maxPoints);

      // Only add counters to nodes that can have multiple points
      if (maxPoints > 1) {
        const currentPoints = parseInt(node.dataset.currentPoints);

        // Check if counter already exists
        let counter = node.querySelector(".point-counter");

        // If counter doesn't exist, create it
        if (!counter) {
          counter = document.createElement("span");
          counter.classList.add("point-counter");
          node.appendChild(counter);
        }

        // Update counter text
        counter.textContent = `${currentPoints}/${maxPoints}`;
      }
    });
  }

  function findDependentNodes(node, dependentNodes) {
    const childrenIds = node.dataset.children?.split(",");
    if (!childrenIds || childrenIds[0] === "") return;

    childrenIds.forEach((childId) => {
      const childNode = document.getElementById(childId.trim());
      if (childNode) {
        // Check if this child has ANY other prerequisites with points
        const prereqIds = childNode.dataset.prereq?.split(",");
        let hasOtherPrereqWithPoints = false;

        if (prereqIds) {
          for (const prereqId of prereqIds) {
            const prereqNode = document.getElementById(prereqId.trim());
            if (
              prereqNode &&
              prereqNode.id !== node.id &&
              parseInt(prereqNode.dataset.currentPoints) > 0
            ) {
              hasOtherPrereqWithPoints = true;
              break;
            }
          }
        }

        // If child has no other valid prereqs and has points, it's dependent
        if (
          !hasOtherPrereqWithPoints &&
          parseInt(childNode.dataset.currentPoints) > 0
        ) {
          dependentNodes.push(childNode);
          // Recursively find any nodes that depend on this child
          findDependentNodes(childNode, dependentNodes);
        }
      }
    });
  }

  // Add this function to ensure common nodes are always properly handled
  function ensureCommonNodesAccessible() {
    // For each common node, ensure it's unlocked and check if prerequisites are met
    commonNodeIds.forEach((nodeId) => {
      const commonNode = document.getElementById(nodeId);
      if (!commonNode) return;

      // Remove path-locked class from common nodes
      commonNode.classList.remove("path-locked");

      // Check if prerequisites are met to determine if it should be available
      const prereqsMet = checkPrerequisites(commonNode);

      // Update the node state based on prerequisites
      if (prereqsMet) {
        if (parseInt(commonNode.dataset.currentPoints) > 0) {
          commonNode.classList.remove("locked", "available", "maxed");
          commonNode.classList.add("invested");
        } else {
          commonNode.classList.remove("locked", "invested", "maxed");
          commonNode.classList.add("available");
        }
      }

      console.log(
        `Ensured common node ${nodeId} is properly handled - prereqs met: ${prereqsMet}`
      );
    });
  }

  // Update updateNodeStates to handle path-locked class correctly
  function updateNodeStates() {
    const activeTreeContent = tabContents[activeTabIndex];
    if (!activeTreeContent) return;
    console.log(`Updating states for tree: ${activeTreeContent.id}`);
    const currentSkillNodes = activeTreeContent.querySelectorAll(".skill-node");

    let changed = false; // Flag to see if any state actually changed

    currentSkillNodes.forEach((node) => {
      const originalClasses = node.className; // Store original classes
      const isPathLocked = node.classList.contains("path-locked");

      const maxPoints = parseInt(node.dataset.maxPoints);
      const currentPoints = parseInt(node.dataset.currentPoints);
      const prereqMet = checkPrerequisites(node);
      const isHighlighted = node.classList.contains("highlighted");

      // Reset state classes (keep 'skill-node', 'highlighted', and 'path-locked')
      node.classList.remove("locked", "available", "invested", "maxed");
      if (isHighlighted) node.classList.add("highlighted");
      if (isPathLocked) node.classList.add("path-locked");

      if (currentPoints >= maxPoints) {
        node.classList.add("maxed");
        unlockChildren(node);
      } else if (currentPoints > 0) {
        node.classList.add("invested");
        unlockChildren(node);
      } else if (prereqMet && !isPathLocked) {
        node.classList.add("available");
        checkAndLockChildren(node);
      } else {
        node.classList.add("locked");
        checkAndLockChildren(node);
      }

      if (node.className !== originalClasses) {
        changed = true;
      }
    });

    // Ensure common nodes are properly handled after all other nodes
    ensureCommonNodesAccessible();

    // Only redraw lines if a state actually changed
    if (changed) {
      console.log("Node states changed, redrawing lines.");
      clearTimeout(window.drawLinesTimeout);
      window.drawLinesTimeout = setTimeout(drawAllLines, 50);
    } else {
      console.log("No node states changed.");
    }
  }

  function resetAllDescendants(parentNode) {
    let totalPointsReturned = 0;

    // Get all direct children of this node
    const childrenIds = parentNode.dataset.children?.split(",");

    // Base case - no children or empty string
    if (!childrenIds || childrenIds[0] === "") {
      return 0;
    }

    // Process each child
    childrenIds.forEach((childId) => {
      const childNode = document.getElementById(childId.trim());
      if (childNode) {
        // First, recursively process this child's descendants (depth-first)
        const pointsFromDescendants = resetAllDescendants(childNode);
        totalPointsReturned += pointsFromDescendants;

        // Then reset the child itself
        const childCurrentPoints = parseInt(childNode.dataset.currentPoints);
        if (childCurrentPoints > 0) {
          childNode.dataset.currentPoints = 0;
          totalPointsReturned += childCurrentPoints;
          console.log(
            `Reset ${childNode.id}, returned ${childCurrentPoints} points`
          );
        }
      }
    });

    return totalPointsReturned;
  }

  function canRemovePoint(nodeToRemovePointFrom, isFullReset = false) {
    // If we're doing a full reset, skip dependency checks
    if (isFullReset) return true;

    const currentPoints = parseInt(nodeToRemovePointFrom.dataset.currentPoints);
    if (currentPoints <= 1) {
      // Only need to check dependencies if removing the last point
      const childrenIds = nodeToRemovePointFrom.dataset.children?.split(",");
      if (!childrenIds || childrenIds[0] === "") return true; // No children, safe to remove

      for (const childId of childrenIds) {
        const childNode = document.getElementById(childId.trim());
        // Check if the child exists AND has points invested
        if (childNode && parseInt(childNode.dataset.currentPoints) > 0) {
          // Now, check if *this parent* is the SOLE prerequisite enabling the child
          const childPrereqIds = childNode.dataset.prereq?.split(",");
          if (!childPrereqIds || childPrereqIds.length === 0) continue; // Should not happen if child is invested, but safety check

          let otherPrereqsMet = false;
          for (const prereqId of childPrereqIds) {
            const trimmedPrereqId = prereqId.trim();
            // Skip checking the node we are considering removing the point from
            if (trimmedPrereqId === nodeToRemovePointFrom.id) continue;

            const prereqNode = document.getElementById(trimmedPrereqId);
            if (prereqNode && parseInt(prereqNode.dataset.currentPoints) > 0) {
              otherPrereqsMet = true;
              break; // Found another valid prerequisite
            }
          }

          // If no other prerequisites are met, removing this point would lock the invested child
          if (!otherPrereqsMet) {
            console.log(
              `Cannot remove point from ${nodeToRemovePointFrom.id}: Child ${childNode.id} depends solely on it.`
            );
            return false;
          }
        }
      }
    }
    // If removing a point > 1, or if all invested children have alternative prerequisites met
    return true;
  }

  // Add these functions right before the closing DOMContentLoaded bracket

  // Add missing unlockAlternativePaths function
  function unlockAlternativePaths(node) {
    // Find all parents that list this node as a child
    const allNodeIds = Array.from(document.querySelectorAll(".skill-node")).map(
      (node) => node.id
    );

    for (const potentialParentId of allNodeIds) {
      const potentialParent = document.getElementById(potentialParentId);
      if (!potentialParent) continue;

      const childrenIds = potentialParent.dataset.children?.split(",");
      if (!childrenIds || childrenIds[0] === "") continue;

      // Clean up the children IDs and check if our node is included
      const trimmedChildrenIds = childrenIds.map((id) => id.trim());
      if (!trimmedChildrenIds.includes(node.id)) continue;

      // If this parent has multiple children
      if (trimmedChildrenIds.length > 1) {
        // Check if any other siblings have points
        let otherSiblingsHavePoints = false;
        for (const siblingId of trimmedChildrenIds) {
          if (siblingId === node.id) continue;

          const siblingNode = document.getElementById(siblingId);
          if (siblingNode && parseInt(siblingNode.dataset.currentPoints) > 0) {
            otherSiblingsHavePoints = true;
            break;
          }
        }

        // Only unlock if no other siblings have points
        if (!otherSiblingsHavePoints) {
          for (const siblingId of trimmedChildrenIds) {
            if (siblingId === node.id) continue;

            const siblingNode = document.getElementById(siblingId);
            if (siblingNode && siblingNode.classList.contains("path-locked")) {
              console.log(`Unlocking alternative path node ${siblingNode.id}`);
              siblingNode.classList.remove("path-locked");
              unlockDescendants(siblingNode);
            }
          }
        }
      }
    }
  }

  // Update unlockDescendants to preserve common node status
  function unlockDescendants(node) {
    // Always unlock this node unless it's already a common node that's unlocked
    if (
      !commonNodeIds.includes(node.id) ||
      node.classList.contains("path-locked")
    ) {
      node.classList.remove("path-locked");
    }

    const childrenIds = node.dataset.children?.split(",");
    if (!childrenIds || childrenIds[0] === "") return;

    childrenIds.forEach((childId) => {
      const childNode = document.getElementById(childId.trim());
      if (childNode) {
        unlockDescendants(childNode);
      }
    });
  }

  // Add missing unlockChildren function (if it doesn't exist)
  function unlockChildren(node) {
    const childrenIds = node.dataset.children?.split(",");
    if (!childrenIds || childrenIds[0] === "") return;

    childrenIds.forEach((childId) => {
      const childNode = document.getElementById(childId.trim());
      if (childNode && parseInt(childNode.dataset.currentPoints) === 0) {
        // Check if prerequisites are met
        if (checkPrerequisites(childNode)) {
          // Check if child is in the active tree
          if (
            childNode.closest(".skill-tree-content.active") ===
            tabContents[activeTabIndex]
          ) {
            // Only update if it would change the state
            if (childNode.classList.contains("locked")) {
              console.log(`Unlocking child: ${childNode.id} (prereqs now met)`);
              childNode.classList.remove("locked");
              childNode.classList.add("available");
            }
          }
        }
      }
    });
  }

  function checkAndLockChildren(parentNode) {
    const childrenIds = parentNode.dataset.children?.split(",");
    if (!childrenIds || childrenIds[0] === "") return;

    childrenIds.forEach((childId) => {
      const childNode = document.getElementById(childId.trim());
      // Check if child exists, has NO points, and is currently available
      if (
        childNode &&
        parseInt(childNode.dataset.currentPoints) === 0 &&
        childNode.classList.contains("available")
      ) {
        // Re-check if prerequisites are STILL met after parent potentially lost a point
        if (!checkPrerequisites(childNode)) {
          // Check if child is in the active tree before changing class
          if (
            childNode.closest(".skill-tree-content.active") ===
            tabContents[activeTabIndex]
          ) {
            console.log(
              `Locking child: ${childNode.id} (prereqs no longer met)`
            );
            childNode.classList.remove("available");
            childNode.classList.add("locked");
          }
        }
      }
    });
  }

  function drawAllLines() {
    const activeTreeContent = tabContents[activeTabIndex];
    if (!activeTreeContent) return;

    const svgLinesContainer = activeTreeContent.querySelector(".skill-lines");
    const currentSkillNodes = activeTreeContent.querySelectorAll(".skill-node");

    if (
      !svgLinesContainer ||
      !currentSkillNodes ||
      currentSkillNodes.length === 0
    ) {
      console.warn(
        `Cannot draw lines: Missing elements in ${activeTreeContent.id}`
      );
      if (svgLinesContainer) svgLinesContainer.innerHTML = "";
      return;
    }
    // console.log(`Drawing lines for tree: ${activeTreeContent.id} (${currentSkillNodes.length} nodes)`);

    svgLinesContainer.innerHTML = ""; // Clear only the active SVG container
    const parentRect = activeTreeContent.getBoundingClientRect(); // Use active content div as reference

    currentSkillNodes.forEach((node) => {
      const childrenIds = node.dataset.children?.split(",");
      if (childrenIds && childrenIds[0] !== "") {
        childrenIds.forEach((childId) => {
          const childNode = document.getElementById(childId.trim());
          // Ensure child node exists AND is within the currently active tree content
          if (
            childNode &&
            childNode.closest(".skill-tree-content.active") ===
              activeTreeContent
          ) {
            // console.log(`Drawing line from ${node.id} to ${childNode.id}`); // Debug
            drawLine(
              node,
              childNode,
              svgLinesContainer,
              activeTreeContent,
              parentRect
            );
          }
        });
      }
    });
  }

  function drawLine(
    fromNode,
    toNode,
    svgContainer,
    relativeElement,
    relativeRect
  ) {
    const startRect = fromNode.getBoundingClientRect();
    const endRect = toNode.getBoundingClientRect();

    const parentStyle = window.getComputedStyle(relativeElement);
    const parentPaddingLeft = parseFloat(parentStyle.paddingLeft);
    const parentPaddingTop = parseFloat(parentStyle.paddingTop);

    const nodeCenterX_vp = startRect.left + startRect.width / 2;
    const nodeCenterY_vp = startRect.top + startRect.height / 2;

    const startX =
      nodeCenterX_vp -
      relativeRect.left -
      parentPaddingLeft +
      relativeElement.scrollLeft;
    const startY =
      nodeCenterY_vp -
      relativeRect.top -
      parentPaddingTop +
      relativeElement.scrollTop;

    const endNodeCenterX_vp = endRect.left + endRect.width / 2;
    const endNodeCenterY_vp = endRect.top + endRect.height / 2;
    const endX =
      endNodeCenterX_vp -
      relativeRect.left -
      parentPaddingLeft +
      relativeElement.scrollLeft;
    const endY =
      endNodeCenterY_vp -
      relativeRect.top -
      parentPaddingTop +
      relativeElement.scrollTop;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", startX);
    line.setAttribute("y1", startY);
    line.setAttribute("x2", endX);
    line.setAttribute("y2", endY);
    line.setAttribute("data-from", fromNode.id);
    line.setAttribute("data-to", toNode.id);

    // Line is active if the STARTING node has points invested
    if (parseInt(fromNode.dataset.currentPoints) > 0) {
      line.classList.add("active");
    } else {
      line.classList.add("inactive"); // Optional: class for inactive lines
    }

    svgContainer.appendChild(line);
  }

  const greatswordNodes = {
    // Add Swift Attack nodes
    "gs0-a": "A",
    "gs0-b": "B",
    "gs0-c": "C",
    "gs0-d": "D",
    "gs0-e": "E",
    "gs0-f": "F",
    "gs0-g": "G",
    "gs0-h": "H",

    // Rest of the nodes remain the same
    "gs1-a": "A",
    "gs1-b": "B",
    "gs1-c": "C",
    "gs1-d": "D",
    "gs1-e": "E",
    "gs1-f": "F",
    "gs1-h": "H",
    "gs2-a": "A",
    "gs2-b": "B",
    "gs2-c": "C",
    "gs2-d": "D",
    "gs2-e": "E",
    "gs2-f": "F",
    "gs2-g": "G",
    "gs2-h": "H",
    "gs3-a": "A",
    "gs3-b": "B",
    "gs3-c": "C",
    "gs3-d": "D",
    "gs3-e": "E",
    "gs3-f": "F",
    "gs3-g": "G",
    "gs4-a": "A",
    "gs4-b": "B",
    "gs4-c": "C",
    "gs4-d": "D",
    "gs4-e": "E",
    "gs4-f": "F",
    "gs4-g": "G",
  };

  // Add these to multi-level nodes list
  const greatswordMultiLevelNodes = [
    "gs0-b", // Swift Attack B (3 points)
    "gs0-c", // Swift Attack C (3 points)
    "gs0-h", // Swift Attack H (3 points)
    // Rest of the multi-level nodes
    "gs1-b",
    "gs1-c",
    "gs2-b",
    "gs2-c",
    "gs3-b",
    "gs3-c",
    "gs4-b",
    "gs4-c",
    "gs4-e",
  ];

  // Add after/before content to display node labels
  Object.entries(greatswordNodes).forEach(([id, letter]) => {
    const node = document.getElementById(id);
    if (node) {
      // Add proper rotation handling for rhombus nodes in Greatsword tree
      if (
        node.classList.contains("node-a") ||
        node.classList.contains("node-d") ||
        node.classList.contains("node-e") ||
        node.classList.contains("node-f") ||
        node.classList.contains("node-g") ||
        node.classList.contains("node-h")
      ) {
        node.dataset.letter = letter; // Store letter in data attribute

        // Remove any existing letter elements
        const existingLetter = node.querySelector(".node-letter");
        if (existingLetter) existingLetter.remove();

        // Create a letter element that's positioned correctly
        const letterElem = document.createElement("span");
        letterElem.className = "node-letter";
        letterElem.textContent = letter;
        letterElem.style.position = "absolute";
        letterElem.style.transform = "rotate(-45deg)"; // Counter-rotate
        letterElem.style.display = "flex";
        letterElem.style.alignItems = "center";
        letterElem.style.justifyContent = "center";
        letterElem.style.width = "100%";
        letterElem.style.height = "100%";
        letterElem.style.pointerEvents = "none"; // Allow clicks through
        letterElem.style.color = "#ccc";
        letterElem.style.fontWeight = "bold";

        node.appendChild(letterElem);
      } else {
        // For circular nodes, just set the text content
        node.textContent = letter;
      }
    }
  });

  // Make sure the greatsword tree's lines are drawn when tab is changed
  const greatswordTab = document.querySelector(
    '.tab-item[data-tab-id="greatsword"]'
  );
  if (greatswordTab) {
    greatswordTab.addEventListener("click", function () {
      setTimeout(() => {
        drawAllLines();
        updatePointCounters();
      }, 100);
    });
  }
}); // End DOMContentLoaded
